#!/usr/bin/env python3
"""PixelLab으로 교체 아트를 만든다 (generate-image-v2, 백그라운드 작업 방식).

한 번 호출에 같은 설명으로 여러 장(24px 이하면 64장)이 나오고, 구독 생성 횟수 10회가 든다.
변형은 art-src/variants/<key>/NN.png, 한눈에 보는 시트는 art-src/sheets/<key>.png 에 저장되고,
art-src/picks.json에 적힌 번호(없으면 0번)를 public/assets/art/<key>.png 로 복사한다.

사용법:
  python3 scripts/pixellab_generate.py gen child-neutral floor   # 생성 (슬롯 여러 개 가능)
  python3 scripts/pixellab_generate.py gen --missing             # 아직 변형이 없는 슬롯 전부
  python3 scripts/pixellab_generate.py pick floor=12 debris=7    # 변형 고르기 → 최종 PNG 갱신
  python3 scripts/pixellab_generate.py balance                   # 남은 생성 횟수

- 슬롯 목록·크기·설명은 src/data/art.ts에서 읽는다 (node 22+).
- 그림체 통일: art-src/style.png 가 있으면 스타일 참고 이미지로 보낸다(외곽선·음영·디테일만, 색은 제외).
- 인증: PIXELLAB_API_KEY 환경 변수가 있으면 Bearer 헤더로 보낸다. 네트워크 시크릿이 헤더를 붙여 주는 환경에서는 필요 없다.
- 끝나면 `npm run art:manifest`로 등록한다. Pillow 필요 (pip install pillow).
"""
import argparse
import base64
import io
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "art"
SRC = ROOT / "art-src"
VAR = SRC / "variants"
SHEETS = SRC / "sheets"
PICKS = SRC / "picks.json"
STYLE = SRC / "style.png"
API = "https://api.pixellab.ai/v2"
SEED = {"child": 1101, "mini": 1201, "tile": 1301, "target": 1401, "portrait": 1501, "adult": 1601, "icon": 1701}


def load_slots():
    code = "import { ART_SLOTS } from './src/data/art.ts'; console.log(JSON.stringify(ART_SLOTS));"
    out = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True, check=True)
    return {s["key"]: s for s in json.loads(out.stdout)}


def request(method, path, body=None, retries=4):
    headers = {"Content-Type": "application/json"}
    key = os.environ.get("PIXELLAB_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(retries + 1):
        req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 502, 503, 529) and attempt < retries:
                wait = int(e.headers.get("Retry-After") or 10 * (attempt + 1))
                print(f"    {path}: {e.code}, {wait}초 후 재시도")
                time.sleep(wait)
                continue
            raise RuntimeError(f"{method} {path} → {e.code}: {msg}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                time.sleep(5)
                continue
            raise RuntimeError(f"{method} {path} → {e}")


def b64png(img):
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def submit(slot):
    body = {
        "description": slot["prompt"],
        "image_size": {"width": slot["w"], "height": slot["h"]},
        "no_background": bool(slot["transparent"]),
        "seed": SEED.get(slot["group"], 1000),
    }
    if STYLE.exists():
        st = Image.open(STYLE).convert("RGBA")
        body["style_image"] = {"image": {"type": "base64", "base64": b64png(st)}, "size": {"width": st.width, "height": st.height}}
        body["style_options"] = {"color_palette": False, "outline": True, "detail": True, "shading": True}
    return request("POST", "/generate-image-v2", body)["background_job_id"]


def wait(job, key):
    for _ in range(120):
        d = request("GET", f"/background-jobs/{job}")
        if d.get("status") == "completed":
            return d
        if d.get("status") == "failed":
            raise RuntimeError(f"{key}: 생성 실패 {json.dumps(d.get('last_response'))[:300]}")
        time.sleep(8)
    raise RuntimeError(f"{key}: 시간 초과 (작업 {job})")


def save_variants(slot, imgs):
    key = slot["key"]
    d = VAR / key
    d.mkdir(parents=True, exist_ok=True)
    for f in d.glob("*.png"):
        f.unlink()
    pics = []
    for i, im in enumerate(imgs):
        p = Image.open(io.BytesIO(base64.b64decode(im["base64"]))).convert("RGBA")
        if p.size != (slot["w"], slot["h"]):
            p = p.crop((0, 0, slot["w"], slot["h"])) if p.width >= slot["w"] and p.height >= slot["h"] else p.resize((slot["w"], slot["h"]), Image.NEAREST)
        p.save(d / f"{i:02d}.png")
        pics.append(p)
    make_sheet(slot, pics)


def make_sheet(slot, pics):
    """번호를 붙인 확대 시트 (고르기용)"""
    from PIL import ImageDraw

    s = max(2, 120 // max(slot["w"], slot["h"]))
    cw, ch = slot["w"] * s + 8, slot["h"] * s + 22
    cols = 8
    rows = (len(pics) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (236, 228, 208, 255))
    dr = ImageDraw.Draw(sheet)
    for i, p in enumerate(pics):
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.alpha_composite(p.resize((slot["w"] * s, slot["h"] * s), Image.NEAREST), (x + 4, y + 18))
        dr.text((x + 4, y + 3), str(i), fill=(29, 27, 44, 255))
    SHEETS.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEETS / f"{slot['key']}.png")


def load_picks():
    return json.loads(PICKS.read_text()) if PICKS.exists() else {}


def apply_pick(key, idx):
    src = VAR / key / f"{idx:02d}.png"
    if not src.exists():
        raise SystemExit(f"{key}: 변형 {idx}번이 없습니다 ({src})")
    OUT.mkdir(parents=True, exist_ok=True)
    Image.open(src).save(OUT / f"{key}.png")


def cmd_gen(slots, keys, parallel):
    picks = load_picks()

    def one(key):
        slot = slots[key]
        job = submit(slot)
        print(f"- {key}: 작업 {job} 시작 ({slot['w']}x{slot['h']})")
        d = wait(job, key)
        imgs = (d.get("last_response") or {}).get("images") or []
        save_variants(slot, imgs)
        apply_pick(key, picks.get(key, 0))
        gens = ((d.get("last_response") or {}).get("billing_usage") or {}).get("generations")
        print(f"  {key}: 변형 {len(imgs)}장 저장 (생성 횟수 {gens})")

    with ThreadPoolExecutor(max_workers=parallel) as ex:
        errors = [f.exception() for f in [ex.submit(one, k) for k in keys]]
    for e in errors:
        if e:
            print(f"오류: {e}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gen")
    g.add_argument("keys", nargs="*")
    g.add_argument("--missing", action="store_true")
    g.add_argument("--parallel", type=int, default=2)
    p = sub.add_parser("pick")
    p.add_argument("pairs", nargs="+", help="key=번호")
    sub.add_parser("balance")
    a = ap.parse_args()

    if a.cmd == "balance":
        print(json.dumps(request("GET", "/balance"), ensure_ascii=False))
        return
    slots = load_slots()
    if a.cmd == "pick":
        picks = load_picks()
        for pair in a.pairs:
            k, _, v = pair.partition("=")
            if k not in slots:
                raise SystemExit(f"알 수 없는 슬롯 {k}")
            apply_pick(k, int(v))
            picks[k] = int(v)
        SRC.mkdir(exist_ok=True)
        PICKS.write_text(json.dumps(dict(sorted(picks.items())), indent=2) + "\n")
        print("선택 반영 완료. 다음: npm run art:manifest")
        return
    keys = [k for k in slots if not (VAR / k).exists()] if a.missing else a.keys
    unknown = [k for k in keys if k not in slots]
    if unknown or not keys:
        raise SystemExit(f"생성할 슬롯을 지정하세요. 알 수 없는 슬롯: {unknown}")
    cmd_gen(slots, keys, a.parallel)


if __name__ == "__main__":
    main()

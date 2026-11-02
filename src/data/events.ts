import type { EventDef } from '../core/types';

// 핵심 사건 6개. 턴 순서 고정, 랜덤 추첨 없음.
// 선택지 배열 순서가 곧 화면 표시 순서다 (사건마다 다르게 배치, 재접속해도 동일).
// 문장 안의 {firstmem}/{firstturn}/{lastmem}은 기억 문장으로 치환된다 (HTML로 해석하지 않음).

export const EVENTS: EventDef[] = [
  // ───────────────────────────── 1턴
  {
    id: 'e1-broken-window',
    turn: 1,
    title: '깨진 유리창',
    prerequisites: [],
    cast: ['child', 'friend'],
    textVariants: [
      '토요일 오후, 놀이터 쪽에서 쨍그랑 소리가 났다. 달려가 보니 아랫집 정 씨네 베란다 유리가 거미줄처럼 금 가 있고, 그 아래로 축구공 하나가 굴러다닌다.',
      '하람은 미끄럼틀 뒤에 웅크리고 있었다. 나무에 걸린 공을 염동력으로 끌어내리려다 힘이 한꺼번에 튀어 나갔다고 한다. 손끝이 아직도 떨리고 있다.',
      '“아무도 못 봤어. 민재만 봤어.” 하람이 작게 말한다. “내가 그런 거 알면… 다들 나 무서워하겠지?”',
    ],
    choices: [
      {
        id: 'e1-apologize',
        teaching: 'protect',
        label: '“같이 가서 사과드리자. 힘을 쓴 사람이 먼저 책임지는 거야.”',
        trust: 1,
        memoryTags: ['responsibility', 'apology'],
        memory: '힘을 쓴 사람이 먼저 책임진다',
        relation: '정 씨 아저씨가 하람의 사과를 받아 주었다.',
        mood: 'thinking',
        reaction: [
          '하람은 한참 발끝만 보다가 고개를 끄덕였다. 정 씨 아저씨는 놀란 얼굴로 깨진 유리를 보더니, 먼저 와서 말해 줘서 고맙다며 하람의 손부터 살폈다. “다친 데는 없니?”',
          '돌아오는 계단에서 하람이 중얼거렸다. “무서웠는데… 말하고 나니까 손이 안 떨려.”',
        ],
      },
      {
        id: 'e1-cover',
        teaching: 'outside',
        label: '“괜찮아, 아무한테도 말하지 마. 유리값은 내가 조용히 해결할게.”',
        trust: 3,
        memoryTags: ['secret', 'shield'],
        memory: '어른들한테 다 말할 필요는 없다. 우리끼리 지키면 된다',
        relation: '하람이 당신에게만 비밀을 털어놓기 시작했다.',
        mood: 'happy',
        reaction: [
          '하람의 어깨에서 힘이 쭉 빠졌다. 그날 밤 당신은 관리사무소에 ‘공이 날아와 깨졌다’고만 전하고 수리비를 냈다. 정 씨 아저씨는 누구 짓인지 끝내 묻지 않았다.',
          '잠들기 전, 하람이 이불 밖으로 얼굴만 내밀었다. “우리만 아는 거지? …다른 어른들은 몰라도 되는 거지?”',
        ],
      },
      {
        id: 'e1-master',
        teaching: 'control',
        label: '“실수는 힘을 다 못 다뤄서 생기는 거야. 아무도 너를 탓 못 하게 완벽해지자.”',
        trust: 0,
        memoryTags: ['strength', 'mastery'],
        memory: '강해지면 아무도 나를 탓하지 못한다',
        relation: '하람이 실수를 사과하기보다 이겨 내려 하기 시작했다.',
        mood: 'fierce',
        reaction: [
          '하람의 눈이 반짝였다. 그날 저녁 내내 하람은 숟가락을 띄웠다 내리기를 반복했다. 열 번, 스무 번. 숟가락이 바닥에 떨어질 때마다 이를 악물었다.',
          '“다음엔 안 깨. 내가 제일 세지면, 아무도 나한테 뭐라고 못 하겠지?” 깨진 유리창 이야기는 그 뒤로 다시 나오지 않았다.',
        ],
      },
    ],
    callbacks: { quotes: [], next: 'e2-playground' },
  },

  // ───────────────────────────── 2턴 (연습 미니게임 후)
  {
    id: 'e2-playground',
    turn: 2,
    title: '운동장의 밀침',
    prerequisites: [{ type: 'eventSeen', eventId: 'e1-broken-window' }],
    cast: ['child', 'friend', 'teacher'],
    minigameIntro: {
      success: '연습장에서 곰 인형을 무사히 꺼낸 다음 주였다. 하람은 잔해가 떠오르던 감각을 몇 번이고 손짓으로 설명했다.',
      partial: '연습장에서 끝까지 해내지는 못한 다음 주였다. 그래도 하람은 잔해가 떠오르던 감각을 몇 번이고 손짓으로 설명했다.',
      none: '연습장에서는 인형까지 닿지 못했다. 하람은 “다음엔 길부터 볼래”라며 연습장 지도를 공책에 그려 두었다. 그런 다음 주의 일이었다.',
    },
    textVariants: [
      '담임 윤 선생님에게서 전화가 왔다. 점심시간, 운동장 구석에서 하람이 같은 반 아이를 염동력으로 밀쳐 넘어뜨렸다는 것이다. 넘어진 아이는 무릎이 까졌다.',
      '사정을 들어 보니, 그 아이는 몇 주째 민재의 실내화를 숨기며 놀려 왔다. 그날은 민재의 가방을 물웅덩이에 던졌다고 한다.',
      {
        variants: [
          {
            when: [{ type: 'teaching', eventId: 'e1-broken-window', is: 'protect' }],
            text: '하람은 교무실 앞에서 당신을 보자마자 말했다. “힘을 쓴 사람이 먼저 책임진다고 했잖아. 그래서 내가 책임지고 민재를 지킨 거야. …근데 걔가 다친 것도 내 책임이야?”',
          },
          {
            when: [{ type: 'teaching', eventId: 'e1-broken-window', is: 'outside' }],
            text: '하람은 교무실 앞에서 당신의 소매를 잡아끌었다. “선생님한테 말해 봤자 소용없었어. 어른들한테 다 말할 필요 없다고 했잖아. 그래서 내가 직접 지킨 거야.”',
          },
          {
            text: '하람은 교무실 앞에서 턱을 들고 서 있었다. “강해지면 아무도 날 탓 못 한다며. 봐, 이제 걔는 민재 못 건드려.” 목소리는 당당했지만 손은 등 뒤로 숨기고 있었다.',
          },
        ],
      },
    ],
    choices: [
      {
        id: 'e2-intimidate',
        teaching: 'control',
        label: '“지킨 건 잘했어. 다음엔 다치게 하지 말고, 겁만 줘서 확실히 눌러 줘.”',
        trust: 2,
        memoryTags: ['intimidate'],
        memory: '다치게 하지 말고, 겁을 줘서 눌러라',
        relation: '괴롭히던 아이가 하람을 피해 다니기 시작했다.',
        mood: 'fierce',
        reaction: [
          '하람은 진지하게 고개를 끄덕였다. “겁만 주기. 알았어.” 다음 날부터 그 아이는 하람과 눈이 마주치면 슬금슬금 자리를 피했다. 민재의 실내화는 더 이상 사라지지 않았다.',
          '그런데 며칠 뒤, 하람은 급식 줄에서 새치기한 다른 아이 앞에서도 손을 들어 보였다. 아이들 사이에 조용히 길이 열렸다. 하람은 그게 싫지 않은 눈치였다.',
        ],
      },
      {
        id: 'e2-together',
        teaching: 'protect',
        label: '“민재를 지키려던 마음은 맞아. 넘어진 아이에게도 사과하고, 선생님과 같이 해결하자.”',
        trust: 0,
        memoryTags: ['apology', 'together'],
        memory: '지키는 것과 다치게 하는 것은 다르다',
        relation: '윤 선생님이 민재의 괴롭힘 문제를 함께 살피기로 했다.',
        mood: 'thinking',
        reaction: [
          {
            variants: [
              {
                when: [{ type: 'teaching', eventId: 'e1-broken-window', is: 'protect' }],
                text: '하람은 입술을 삐죽였지만 넘어진 아이 앞에 섰다. “유리창 때처럼… 내가 먼저 말할게.” 그리고 사과했다.',
              },
              { text: '하람은 억울한 얼굴로 한참 버티다가, 결국 넘어진 아이에게 사과했다.' },
            ],
          },
          '윤 선생님은 민재의 일을 처음 알았다며 놀라더니, 반 아이들과 이야기해 보겠다고 했다. 돌아가는 길에 하람이 물었다. “어른들한테 말하면… 진짜 바뀌어?” 당신은 대답 대신 하람의 손을 꼭 잡았다.',
        ],
      },
      {
        id: 'e2-secret-guard',
        teaching: 'outside',
        label: '“선생님들이 몰랐던 걸 네가 지켜 줬구나. 넌 잘못 안 했어. 다음엔 들키지만 말자.”',
        trust: 3,
        memoryTags: ['secret', 'vigilante'],
        memory: '어른들이 못 지키면 내가 지킨다. 들키지만 않으면 된다',
        relation: '민재가 하람에게 더 의지하기 시작했다.',
        mood: 'happy',
        reaction: [
          '하람의 얼굴이 활짝 펴졌다. 반성문은 써 냈지만, 집에 오는 길 내내 하람은 콧노래를 불렀다.',
          '그날 밤 하람이 공책에 무언가를 적었다. 표지에는 삐뚤빼뚤한 글씨로 ‘비밀 순찰 일지’라고 쓰여 있었다. 첫 줄은 민재의 이름이었다.',
        ],
      },
    ],
    callbacks: { quotes: ['e1-broken-window'], next: 'e3-fight-for-me' },
  },

  // ───────────────────────────── 3턴
  {
    id: 'e3-fight-for-me',
    turn: 3,
    title: '대신 싸워 줘',
    prerequisites: [{ type: 'eventSeen', eventId: 'e2-playground' }],
    cast: ['child', 'friend'],
    textVariants: [
      {
        variants: [
          {
            when: [{ type: 'teaching', eventId: 'e2-playground', is: 'control' }],
            text: '민재가 요즘 부쩍 하람 뒤를 따라다닌다. 오늘은 숨을 헐떡이며 현관까지 찾아왔다. “하람아, 4반 애가 축구하다 반칙했어. 네가 가서 한 번만 겁 좀 줘. 네가 손만 들면 다들 조용해지잖아.”',
          },
          {
            when: [{ type: 'teaching', eventId: 'e2-playground', is: 'outside' }],
            text: '민재가 ‘비밀 순찰’ 이야기를 소곤거리며 현관까지 찾아왔다. “하람아, 4반 애가 축구하다 반칙했어. 선생님은 몰라. 우리끼리 혼내 주자, 응?”',
          },
          {
            text: '민재가 숨을 헐떡이며 현관까지 찾아왔다. 괴롭힘은 윤 선생님 덕분에 잦아들었지만, 민재는 여전히 하람을 제일 먼저 찾는다. “하람아, 4반 애가 축구하다 반칙했어. 네가 같이 가서 말 좀 해 줘.”',
          },
        ],
      },
      '사정을 들어 보니 공이 선을 넘었는지를 두고 말다툼이 붙은 정도였다. 누가 다친 것도 아니다. 하지만 민재는 꽤 억울했던지 눈가가 빨갛다.',
      '하람이 당신을 돌아본다. 가겠다는 건지, 말려 달라는 건지 알 수 없는 얼굴이다. “민재는 내 제일 친한 친구잖아. …나 어떻게 해?”',
    ],
    choices: [
      {
        id: 'e3-loyal-secret',
        teaching: 'outside',
        label: '“친구 편이 되어 주는 건 좋아. 대신 어른들 모르게, 둘이서 조용히 처리해.”',
        trust: 1,
        memoryTags: ['loyalty', 'secret'],
        memory: '친구 편은 끝까지 든다. 어른들 몰래라도',
        relation: '민재와 하람이 둘만의 약속을 만들었다.',
        mood: 'happy',
        reaction: [
          '하람은 민재와 새끼손가락을 걸고 나갔다. 해 질 무렵 돌아온 두 아이는 무슨 일이 있었는지 끝내 말하지 않았다. 다만 민재는 “역시 하람이밖에 없어”라고 몇 번이나 말했다.',
          {
            variants: [
              {
                when: [{ type: 'teaching', eventId: 'e1-broken-window', is: 'outside' }],
                text: '하람이 신발을 벗으며 웃었다. “우리끼리 지키면 된다고 했잖아. 이번에도 그렇게 했어.”',
              },
              { text: '하람은 신발을 벗으며 웃었지만, 손등에 작은 긁힌 자국이 있었다. 당신이 묻자 하람은 소매를 끌어내렸다.' },
            ],
          },
        ],
      },
      {
        id: 'e3-make-them-listen',
        teaching: 'control',
        label: '“네가 나서면 금방 끝나. 다들 네 말을 듣게 만들어. 그래야 다시는 안 덤벼.”',
        trust: -1,
        memoryTags: ['authority', 'dependency'],
        memory: '내 말을 듣게 만들면 싸움은 끝난다',
        relation: '민재가 하람 없이는 아무것도 못 하겠다고 말했다.',
        mood: 'fierce',
        reaction: [
          '하람은 운동장에 가서 공을 공중에 띄운 채 물었다고 한다. “선 넘었어, 안 넘었어?” 4반 아이는 “넘었어…”라고 대답했다. 다툼은 일 분 만에 끝났다.',
          '저녁에 민재 어머니가 전화를 걸어 왔다. 민재가 요즘 하람 없이는 학교에 안 가겠다고 한다고. 하람은 그 이야기를 듣고 조금 우쭐해 보였다.',
        ],
      },
      {
        id: 'e3-stand-beside',
        teaching: 'protect',
        label: '“이번엔 네가 싸울 일이 아니야. 민재가 직접 말할 수 있게 옆에 있어 줘.”',
        trust: 2,
        memoryTags: ['empower', 'restraint'],
        memory: '대신 싸워 주는 것보다 옆에 서 주는 게 더 힘이 된다',
        relation: '민재가 처음으로 혼자 자기 생각을 말했다.',
        mood: 'thinking',
        reaction: [
          '하람은 힘을 쓰지 않고 민재 옆에만 서 있었다. 민재는 목소리를 떨며 “선은 넘었지만 반칙은 아니었어. 그럼 다시 하자”라고 말했고, 경기는 다시 시작됐다.',
          {
            variants: [
              {
                when: [{ type: 'teaching', eventId: 'e2-playground', is: 'control' }],
                text: '돌아온 하람이 투덜댔다. “겁 주면 금방 끝났을 텐데.” 그러다 조그맣게 덧붙였다. “…근데 민재가 웃는 거, 오랜만에 봤어.”',
              },
              { text: '돌아온 하람이 말했다. “민재 목소리, 원래 그렇게 컸나 봐.”' },
            ],
          },
        ],
      },
    ],
    callbacks: { quotes: ['e2-playground', 'e1-broken-window'], next: 'e4-two-signals' },
  },

  // ───────────────────────────── 4턴 (구조 훈련 후)
  {
    id: 'e4-two-signals',
    turn: 4,
    title: '두 개의 신호',
    prerequisites: [{ type: 'eventSeen', eventId: 'e3-fight-for-me' }],
    cast: ['child', 'teacher'],
    minigameIntro: {
      success: '훈련이 끝났다. 두 인형 모두 구조 완료. 기록판 맨 위에 하람의 이름이 올랐다.',
      partial: '훈련이 끝났다. 인형 하나는 구했지만, 다른 하나에는 끝내 닿지 못한 채 종료 신호가 울렸다.',
      none: '훈련이 끝났다. 인형까지 닿지 못한 채 종료 신호가 울렸다. 하람은 잔해 앞에서 한참 서 있었다.',
    },
    textVariants: [
      {
        variants: [
          {
            when: [{ type: 'minigameFirst', turn: 4, targetId: 'doll-blue' }],
            text: '기록을 확인하던 윤 선생님이 굳은 얼굴로 하람을 불렀다. “훈련 규칙은 빨간 표식부터였지. 왜 순서를 바꿨니?” 하람은 “우는 소리가 들렸어요. 더 가까웠고요”라고 대답했다.',
          },
          {
            when: [{ type: 'minigameFirst', turn: 4, targetId: 'doll-red' }],
            text: '기록을 확인하던 윤 선생님은 “규칙대로 빨간 표식부터 구했구나” 하고 고개를 끄덕였다. 하지만 하람의 표정은 밝지 않았다. “우는 소리 인형이 더 가까웠는데… 계속 그 소리가 들렸어요.”',
          },
          {
            text: '윤 선생님은 기록판을 내려놓고 하람의 어깨를 짚었다. “괜찮아, 훈련이니까.” 하지만 하람은 고개를 저었다. “빨간 표식부터 가야 하는지, 우는 쪽부터 가야 하는지 고민하다가… 시간이 다 갔어요.”',
          },
        ],
      },
      {
        variants: [
          {
            when: [
              { type: 'minigameRescued', turn: 4, targetId: 'doll-red', is: true },
              { type: 'minigameRescued', turn: 4, targetId: 'doll-blue', is: false },
            ],
            text: '결국 우는 소리 인형은 구하지 못했다. 규칙을 따른 길이 더 멀었다.',
          },
          {
            when: [
              { type: 'minigameRescued', turn: 4, targetId: 'doll-red', is: false },
              { type: 'minigameRescued', turn: 4, targetId: 'doll-blue', is: true },
            ],
            text: '빨간 표식 인형은 끝내 구하지 못했다. 평가표의 ‘규칙 준수’ 칸에 줄이 그어졌다.',
          },
          {
            text: '윤 선생님은 실제 현장에서는 순서를 정해 둔 이유가 있다고 했다. 빨간 표식은 구조대가 먼저 확인한 ‘가장 위험한 사람’이라는 뜻이라고.',
          },
        ],
      },
      '집에 오는 길, 하람이 물었다. “규칙대로 하는 게 맞아? 내가 보기에 급한 사람을 먼저 구하는 게 맞아?”',
    ],
    choices: [
      {
        id: 'e4-ask-why',
        teaching: 'protect',
        label: '“규칙은 네가 못 보는 위험을 알려 주기도 해. 이유를 묻고, 그래도 다르면 선생님께 말해 보자.”',
        trust: 1,
        memoryTags: ['rules-why', 'dialogue'],
        memory: '규칙에는 이유가 있다. 이유를 묻고, 다르면 말로 바꾼다',
        relation: '하람이 윤 선생님에게 훈련 규칙의 이유를 물어보러 갔다.',
        mood: 'thinking',
        reaction: [
          '다음 날 하람은 윤 선생님을 찾아가 표식의 의미를 물었다. 선생님은 실제 사고 기록을 보여 주었고, 하람은 오랫동안 그 종이를 들여다보았다.',
          '“근데 선생님, 소리가 들리는 사람은 표식이 없어도 급한 거 아니에요?” 윤 선생님은 잠시 말을 멈추더니, 다음 훈련 규칙에 ‘현장 판단 보고’ 항목을 넣어 보겠다고 했다.',
        ],
      },
      {
        id: 'e4-trust-power',
        teaching: 'control',
        label: '“현장에선 결국 네 판단이 제일 빨라. 네가 해낼 수 있다면 규칙보다 네 힘을 믿어.”',
        trust: 2,
        memoryTags: ['self-judgment', 'power-first'],
        memory: '규칙보다 내 힘과 판단이 먼저다',
        relation: '하람이 훈련 규칙을 가볍게 여기기 시작했다.',
        mood: 'fierce',
        reaction: [
          {
            variants: [
              {
                when: [{ type: 'minigameFirst', turn: 4, targetId: 'doll-blue' }],
                text: '“거봐, 내가 맞았잖아.” 하람이 주먹을 쥐었다.',
              },
              { text: '“다음엔 순서 같은 거 신경 안 쓸래. 둘 다 내가 구하면 되잖아.” 하람이 주먹을 쥐었다.' },
            ],
          },
          '그 주 내내 하람은 훈련 시간에 신호를 기다리지 않고 먼저 움직였다. 기록은 빨라졌고, 윤 선생님의 표정은 점점 어두워졌다.',
        ],
      },
      {
        id: 'e4-pretend',
        teaching: 'outside',
        label: '“규칙은 어른들이 편하자고 만든 거야. 겉으로는 지키고, 진짜 급할 땐 네 마음대로 해.”',
        trust: 0,
        memoryTags: ['pretend', 'hidden-judgment'],
        memory: '규칙은 지키는 척만 하고, 진짜 중요한 건 내가 정한다',
        relation: '하람이 윤 선생님 앞에서 말수가 줄었다.',
        mood: 'neutral',
        reaction: [
          '하람은 다음 훈련에서 빨간 표식부터 구했다. 평가표에는 ‘규칙 준수’ 도장이 찍혔다. 그런데 집에 와서 몰래 말했다. “사실 선생님 안 볼 때, 다른 인형부터 옮겨 놨어.”',
          '“어른들은 겉만 보잖아.” 하람은 그렇게 말하고 조금 쓸쓸하게 웃었다.',
        ],
      },
    ],
    callbacks: { quotes: ['e3-fight-for-me'], next: 'e5-teacher' },
  },

  // ───────────────────────────── 5턴
  {
    id: 'e5-teacher',
    turn: 5,
    title: '선생님은 왜',
    prerequisites: [{ type: 'eventSeen', eventId: 'e4-two-signals' }],
    cast: ['child', 'teacher', 'friend'],
    textVariants: [
      '민재가 사흘째 학교에 오지 않았다. 하람이 알아낸 바로는, 6학년 형들이 민재에게 돈을 빌려 가고는 갚지 않는다고 한다. 민재는 그 사실을 윤 선생님께 털어놓았다.',
      '하지만 윤 선생님은 “확인해 보겠다”고만 하고 일주일이 지났다. 그사이 형들은 민재를 또 불러냈다. 하람은 복도에서 윤 선생님이 다른 반 선생님과 웃으며 이야기하는 걸 보았다고 했다.',
      {
        variants: [
          {
            when: [{ type: 'teaching', eventId: 'e4-two-signals', is: 'protect' }],
            text: '“이유를 물어보라고 했잖아. 근데 이번엔 물어보러 갈 기분도 안 들어.” 하람이 가방을 내던졌다. “선생님은 민재 일을 잊어버린 거야.”',
          },
          {
            when: [{ type: 'teaching', eventId: 'e2-playground', is: 'outside' }],
            text: '“역시 어른들은 믿으면 안 돼.” 하람이 비밀 순찰 일지를 펼쳤다. 거기에는 형들의 이름과 하교 시간이 빼곡하게 적혀 있었다.',
          },
          {
            when: [{ type: 'dominantTeaching', is: 'control' }],
            text: '“선생님은 아무것도 안 해. 내가 가면 그 형들, 한 번에 조용해질 거야.” 하람의 손끝에서 연필꽂이가 덜덜 떨렸다.',
          },
          { text: '“선생님은 민재 일을 잊어버린 거야.” 하람이 가방을 내던졌다. “어른들은 다 그래?”' },
        ],
      },
      '사실 당신은 오늘 아침 학교 알림장에서 ‘학교폭력 조사 위원회 소집’ 공지를 보았다. 윤 선생님이 지금 무엇을 하고 있는지는 아직 아무도 모른다.',
    ],
    choices: [
      {
        id: 'e5-show-them',
        teaching: 'control',
        label: '“기다릴 필요 없어. 그 형들이 다시는 못 그러게, 네가 확실히 본때를 보여 줘.”',
        trust: -2,
        memoryTags: ['punish', 'power-order'],
        memory: '느린 어른들 대신 내가 힘으로 질서를 세운다',
        relation: '6학년 형들이 하람을 두려워하게 되었다. 윤 선생님은 하람을 따로 불렀다.',
        mood: 'fierce',
        reaction: [
          '다음 날, 6학년 형들의 사물함 문이 한꺼번에 비틀려 열렸다. 하람은 그 앞에 서서 말했다. “민재 돈, 내일까지.” 돈은 정말로 다음 날 돌아왔다.',
          '윤 선생님이 전화를 걸어왔다. 조사 위원회가 바로 다음 주에 열릴 예정이었다고. “하람이가 조금만 기다려 줬더라면…” 목소리가 지쳐 있었다. 하람은 그 말을 전해 듣고도 어깨를 으쓱했다. “결과는 내가 더 빨랐잖아.”',
        ],
      },
      {
        id: 'e5-gather-secret',
        teaching: 'outside',
        label: '“선생님이 못 하면 우리가 해. 어른들한테 맡기지 말고, 증거부터 몰래 모으자.”',
        trust: 2,
        memoryTags: ['evidence-secret', 'self-reliance'],
        memory: '어른들에게 맡기지 말고, 증거는 우리가 직접 쥔다',
        relation: '하람과 민재가 몰래 증거를 모았다. 윤 선생님과는 거리가 생겼다.',
        mood: 'neutral',
        reaction: [
          '하람은 염동력으로 형들 가방 속의 차용 쪽지를 살짝 꺼내 사진을 찍었다. 민재는 망을 봤다. 두 아이는 그 사진을 아무에게도 보여 주지 않고 상자에 넣어 침대 밑에 숨겼다.',
          '얼마 뒤 조사 위원회가 열렸지만, 하람은 끝내 사진을 내지 않았다. “어차피 또 ‘확인해 보겠다’고 할 거잖아.” 형들은 경고만 받았다. 하람은 거봐, 하는 얼굴로 상자를 다시 밀어 넣었다.',
        ],
      },
      {
        id: 'e5-speak-up',
        teaching: 'protect',
        label: '“선생님 사정을 아직 몰라. 같이 찾아가서, 민재가 지금 위험하다고 분명하게 말하자.”',
        trust: 1,
        memoryTags: ['dialogue', 'institution'],
        memory: '답답해도 먼저 묻고, 분명하게 말한다',
        relation: '윤 선생님이 하람에게 조사 과정을 설명해 주었다.',
        mood: 'thinking',
        reaction: [
          '윤 선생님은 하람과 당신을 상담실로 데려가 사정을 털어놓았다. 형들의 일은 이미 조사 위원회에 올라가 있었고, 절차 때문에 민재에게도 아직 말할 수 없었다고.',
          {
            variants: [
              {
                when: [{ type: 'teaching', eventId: 'e4-two-signals', is: 'protect' }],
                text: '“이유를 물어보니까… 진짜 이유가 있었네.” 하람은 기대한 대답은 아니라는 듯 입을 비죽였지만, 훈련장 때처럼 끝까지 들었다.',
              },
              {
                text: '“그래도 너무 느려요.” 하람의 말에 윤 선생님은 고개를 끄덕였다. “맞아, 느려. 그래서 너 같은 사람이 계속 말해 줘야 해.”',
              },
            ],
          },
          '위원회는 다음 주에 열렸다. 민재는 돈을 돌려받았고, 다시 학교에 나왔다.',
        ],
      },
    ],
    callbacks: { quotes: ['e4-two-signals', 'e2-playground'], next: 'e6-how-to-use' },
  },

  // ───────────────────────────── 6턴 (실제 구조 후)
  {
    id: 'e6-how-to-use',
    turn: 6,
    title: '힘을 어떻게 써야 해?',
    prerequisites: [{ type: 'eventSeen', eventId: 'e5-teacher' }],
    cast: ['child', 'villain'],
    minigameIntro: {
      success: '정전된 시장 골목에서 갇힌 상인과 다친 학생이 모두 구조되었다.',
      partial: '정전된 시장 골목에서 하람은 한 사람을 구했다. 다른 한 사람은 뒤이어 도착한 구조대가 무사히 꺼냈다.',
      none: '정전된 시장 골목에서 하람은 사람들에게까지 닿지 못했다. 시민들은 뒤이어 도착한 구조대가 꺼냈고, 다친 사람은 있었지만 모두 무사했다.',
    },
    textVariants: [
      {
        variants: [
          {
            when: [{ type: 'minigameRescued', turn: 6, targetId: 'evidence', is: true }],
            text: '하람이 챙겨 온 상자 안에는 배전반을 망가뜨린 장치와 ‘블랙아웃’이라는 서명이 적힌 쪽지가 있었다. 경찰은 그 상자 덕분에 이번 정전이 사고가 아니라는 걸 알게 됐다.',
          },
          {
            text: '현장 어딘가에 있던 증거 상자는 무너진 골목 아래에 묻혔다. 경찰은 이번 정전을 ‘블랙아웃’이라 불리는 능력자의 짓으로 의심하지만, 증명할 방법이 없다고 했다.',
          },
        ],
      },
      {
        variants: [
          {
            when: [{ type: 'minigameFirst', turn: 6, targetId: 'evidence' }],
            text: '구조 기록을 본 구조대장이 고개를 갸웃했다. “사람보다 상자를 먼저 챙겼네?” 하람은 아무 대답도 하지 않았다.',
          },
          { text: '구조대장은 하람의 등을 두드렸다. “처음 나온 현장치고 침착했다.”' },
        ],
      },
      '그날 밤, 하람은 잠들지 못하고 거실로 나왔다. 손바닥에는 잔해를 들어 올리던 감각이 아직 남아 있다.',
      {
        variants: [
          {
            when: [{ type: 'dominantTeaching', is: 'protect' }],
            text: '“{firstturn}월에 해 준 말, 기억나? ‘{firstmem}’. 오늘 골목에서 그 말이 계속 들렸어.” 하람이 당신을 올려다본다. “그런데 블랙아웃 같은 사람은 책임을 안 지잖아. …나는 이 힘을 어떻게 써야 해?”',
          },
          {
            when: [{ type: 'dominantTeaching', is: 'outside' }],
            text: '“{firstturn}월에 해 준 말, 기억나? ‘{firstmem}’. 오늘도 어른들은 늦게 왔어. 결국 우리가 해야 하는 거지?” 하람이 당신을 올려다본다. “블랙아웃은 지금도 어디선가 웃고 있을 거야. …나는 이 힘을 어떻게 써야 해?”',
          },
          {
            text: '“{firstturn}월에 해 준 말, 기억나? ‘{firstmem}’. 오늘 거기서 내가 제일 셌어. 다들 내 말대로 움직였어.” 하람이 당신을 올려다본다. “블랙아웃보다 내가 더 세지면, 아무도 그런 짓 못 하게 할 수 있잖아. …그렇게 써도 되는 거지?”',
          },
        ],
      },
    ],
    choices: [
      {
        id: 'e6-shadow',
        teaching: 'outside',
        label: '“규칙이 늦으면 네가 먼저 움직여. 대신 다치는 사람이 없게, 아무도 모르게.”',
        trust: 1,
        memoryTags: ['shadow', 'guardian'],
        memory: '규칙이 늦으면 내가 먼저, 아무도 모르게 지킨다',
        relation: '하람이 밤마다 창밖 거리를 내려다보기 시작했다.',
        mood: 'neutral',
        reaction: [
          '하람은 오래 생각하다가 고개를 끄덕였다. “아무도 모르게. …그럼 아무도 날 막을 수 없겠다.”',
          {
            variants: [
              {
                when: [{ type: 'minigameRescued', turn: 6, targetId: 'evidence', is: true }],
                text: '하람은 증거 상자 사진을 스케치북 맨 앞장에 붙였다. ‘블랙아웃’. 그 이름 위에 동그라미를 몇 번이고 그렸다.',
              },
              { text: '하람은 시장 골목 지도를 스케치북에 그리고, 블랙아웃이 숨을 만한 곳마다 동그라미를 쳤다.' },
            ],
          },
        ],
      },
      {
        id: 'e6-protect-all',
        teaching: 'protect',
        label: '“힘은 사람을 지키는 데 써. 나쁜 사람이라도, 벌은 증거와 절차로 받게 하는 거야.”',
        trust: 2,
        memoryTags: ['justice', 'protect-all'],
        memory: '힘은 사람을 지키는 데 쓰고, 벌은 증거와 절차로 받게 한다',
        relation: '하람이 구조대 견학을 신청했다.',
        mood: 'happy',
        reaction: [
          {
            variants: [
              {
                when: [{ type: 'minigameRescued', turn: 6, targetId: 'evidence', is: true }],
                text: '“그럼 상자 챙긴 거, 잘한 거구나.” 하람이 처음으로 오늘 일을 이야기하며 웃었다.',
              },
              { text: '“다음엔 증거도 챙길 거야. 사람 다 구하고 나서.” 하람이 손가락을 꼽으며 말했다.' },
            ],
          },
          '“나쁜 사람도 지켜야 해?” “다치게 하지 않고 데려와야, 다시는 그런 일을 못 하게 할 수 있으니까.” 하람은 그 말을 공책 첫 장에 옮겨 적었다.',
        ],
      },
      {
        id: 'e6-strongest',
        teaching: 'control',
        label: '“센 사람이 질서를 정하는 거야. 네가 제일 강해지면, 아무도 그런 짓을 못 해.”',
        trust: 0,
        memoryTags: ['order', 'supremacy'],
        memory: '가장 강한 사람이 질서를 정한다',
        relation: '하람이 매일 밤 혼자 훈련을 늘렸다.',
        mood: 'fierce',
        reaction: [
          '하람의 눈빛이 단단해졌다. “제일 강해지면… 아무도 정전 같은 거 못 일으키게 할 수 있어. 시장 사람들도, 민재도, 다 내가 지킬 수 있어.”',
          '그날 밤 거실의 화분, 책, 의자가 한꺼번에 공중에 떠올랐다가 아주 천천히, 정확하게 제자리로 내려앉았다. 하람은 그 광경을 오래 바라보았다.',
        ],
      },
    ],
    callbacks: { quotes: ['e1-broken-window', 'e2-playground', 'e3-fight-for-me', 'e4-two-signals', 'e5-teacher'], next: null },
  },
];

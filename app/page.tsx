"use client"

import { useState, useEffect, useCallback } from "react"
import type { ElementType } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Coins, User, BarChart3, Settings, Scissors, Mountain, Hand, Star } from "lucide-react"

// 타입 정의
type Choice = "rock" | "paper" | "scissors"
type GameResult = "win" | "lose" | "draw"

interface GameStats {
  wins: number
  losses: number
  draws: number
  totalGames: number
  winStreak: number
  maxWinStreak: number
  gold: number
  level: number
  exp: number
  selectedSkin: string
  unlockedSkins: string[]
}

interface AiPattern {
  lastPlayerChoices: Choice[] // 플레이어의 지난 선택을 추적
  playerWinChoices: Record<Choice, number> // 플레이어가 각 패로 승리한 횟수
  aiLossStreak: number // AI의 연패 횟수
}

// 상수 정의
const CHOICES: { value: Choice; icon: ElementType; label: string; color: string }[] = [
  { value: "rock", icon: Mountain, label: "바위", color: "text-gray-600" },
  { value: "paper", icon: Hand, label: "보", color: "text-blue-600" },
  { value: "scissors", icon: Scissors, label: "가위", color: "text-red-600" },
]

// 스킨 정의 (레벨에 따라 해금)
const SKINS = [
  { id: "default", name: "기본 손", levelRequired: 1, rarity: "common" },
  { id: "golden", name: "황금 손", levelRequired: 2, rarity: "rare" },
  { id: "diamond", name: "다이아몬드 손", levelRequired: 4, rarity: "epic" },
  { id: "rainbow", name: "무지개 손", levelRequired: 6, rarity: "legendary" }, // 총 50승=레벨 6+가 되도록 EXP 설정
]

// 레벨에 필요한 총 승리 횟수 (누적)
const LEVEL_WIN_REQUIREMENTS = [0, 1, 3, 7, 13, 20, 50]; // 레벨 1, 2, 3... 에 필요한 총 승리 횟수 (누적)

export default function RockPaperScissorsGame() {
  const [gameStats, setGameStats] = useState<GameStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    totalGames: 0,
    winStreak: 0,
    maxWinStreak: 0,
    gold: 0, // 초기 골드 0으로 설정 (승리 시에만 얻도록)
    level: 1,
    exp: 0,
    selectedSkin: "default",
    unlockedSkins: ["default"],
  })

  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null)
  const [aiChoice, setAiChoice] = useState<Choice | null>(null)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [rewardAnimation, setRewardAnimation] = useState<string | null>(null)
  const [aiHintText, setAiHintText] = useState<string>("") // AI 힌트 텍스트
  const [aiDeceptionState, setAiDeceptionState] = useState<{ active: boolean; initialChoice: Choice | null; finalChoice: Choice | null }>({ active: false, initialChoice: null, finalChoice: null }); // AI 기만 상태

  const [aiPattern, setAiPattern] = useState<AiPattern>({
    lastPlayerChoices: [],
    playerWinChoices: { rock: 0, paper: 0, scissors: 0 },
    aiLossStreak: 0,
  })

  // 샌즈: 기획서 팝업 관련 상태
  const [showPlanPopup, setShowPlanPopup] = useState(false);
  const [showPlanDocument, setShowPlanDocument] = useState(false);
  const SHOW_PLAN_ON_FIRST_LOAD = true; // 샌즈: 이 값을 false로 바꾸면 첫 접속 시 기획서 팝업이 뜨지 않습니다. (서버에서 구동 시)

  // 로컬 스토리지 데이터 로드 및 저장
  useEffect(() => {
    const savedStats = localStorage.getItem("rps-game-stats")
    if (savedStats) {
      setGameStats(JSON.parse(savedStats))
    }

    const savedPattern = localStorage.getItem("rps-ai-pattern")
    if (savedPattern) {
      setAiPattern(JSON.parse(savedPattern))
    }

    // 샌즈: 첫 접속 시 기획서 팝업 표시 여부
    const hasVisitedBefore = localStorage.getItem("rps-has-visited");
    if (SHOW_PLAN_ON_FIRST_LOAD && !hasVisitedBefore) {
      setShowPlanPopup(true);
      localStorage.setItem("rps-has-visited", "true"); // 다시 뜨지 않도록 기록
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("rps-game-stats", JSON.stringify(gameStats))
  }, [gameStats])

  useEffect(() => {
    localStorage.setItem("rps-ai-pattern", JSON.stringify(aiPattern))
  }, [aiPattern])

  // AI 심리전 로직
  const getAiStrategicChoice = useCallback((): { choice: Choice; hintType: number; hintValue: string | null; initialDeceptionChoice?: Choice; } => {
    const choices: Choice[] = ["rock", "paper", "scissors"];
    const counter: Record<Choice, Choice> = { rock: "paper", paper: "scissors", scissors: "rock" };
    
    // AI 기만 전략 (3연패 시 발동)
    if (aiPattern.aiLossStreak >= 3 && Math.random() < 0.7) { // 70% 확률로 기만
      const deceivingChoice = choices[Math.floor(Math.random() * choices.length)]; // 기만으로 보여줄 패
      const actualChoice = counter[deceivingChoice]; // 기만 패를 이기는 패 (AI가 실제로 낼 패)
      setAiDeceptionState({ active: true, initialChoice: deceivingChoice, finalChoice: actualChoice });
      setAiHintText(`AI가 3연패를 했습니다. 당신을 속이려 합니다! (${CHOICES.find(c => c.value === deceivingChoice)?.label}?)`); // 기만 힌트 (어떤 패로 기만하는지 명시)
      return { choice: actualChoice, hintType: 3, hintValue: CHOICES.find(c => c.value === deceivingChoice)?.label, initialDeceptionChoice: deceivingChoice };
    }

    // 유형 1: 플레이어가 자주 낸 패 눈치챘을 때
    if (aiPattern.lastPlayerChoices.length >= 3) {
      const recentChoices = aiPattern.lastPlayerChoices.slice(-3);
      const choiceCounts = recentChoices.reduce((acc, choice) => {
        acc[choice] = (acc[choice] || 0) + 1;
        return acc;
      }, { rock: 0, paper: 0, scissors: 0 } as Record<Choice, number>);

      let mostFrequentChoice: Choice = "rock";
      let maxCount = -1;
      for (const c of choices) {
        if (choiceCounts[c] > maxCount) {
          maxCount = choiceCounts[c];
          mostFrequentChoice = c;
        }
      }

      if (maxCount >= 2 && Math.random() < 0.6) { // 60% 확률로 최다 빈도에 대한 카운터
        setAiHintText(`AI는 당신이 '${CHOICES.find(c => c.value === mostFrequentChoice)?.label}'을(를) 제일 많이 냈다는 걸 눈치챘습니다.`);
        return { choice: counter[mostFrequentChoice], hintType: 1, hintValue: CHOICES.find(c => c.value === mostFrequentChoice)?.label };
      }
    }

    // 유형 2: 플레이어가 특정 패로 많이 이겼을 때
    const totalWinsByChoice = Object.values(aiPattern.playerWinChoices).reduce((sum, count) => sum + count, 0);
    if (totalWinsByChoice > 0) {
      let mostWinningChoice: Choice = "rock";
      let maxWinCount = -1;
      for (const c of choices) {
        if (aiPattern.playerWinChoices[c] > maxWinCount) {
          maxWinCount = aiPattern.playerWinChoices[c];
          mostWinningChoice = c;
        }
      }

      if (maxWinCount > 1 && Math.random() < 0.5) { // 50% 확률로 최다 승리 패에 대한 카운터
        setAiHintText(`AI는 당신이 '${CHOICES.find(c => c.value === mostWinningChoice)?.label}'으로 많이 이겼다는 걸 눈치챘습니다.`);
        return { choice: counter[mostWinningChoice], hintType: 2, hintValue: CHOICES.find(c => c.value === mostWinningChoice)?.label };
      }
    }

    // 기본 랜덤 선택
    setAiHintText("AI는 당신의 다음 수를 예측하려 합니다."); // 기본 힌트
    return { choice: choices[Math.floor(Math.random() * choices.length)], hintType: 0, hintValue: null };
  }, [aiPattern]);


  // 게임 결과 판정
  const determineWinner = (player: Choice, ai: Choice): GameResult => {
    if (player === ai) return "draw"

    const winConditions: Record<Choice, Choice> = {
      rock: "scissors",
      paper: "rock",
      scissors: "paper",
    }
    return winConditions[player] === ai ? "win" : "lose"
  }

  // 보상 계산 (승리 시에만 EXP/골드, 패배/무승부 시 보상 없음)
  const calculateRewards = (result: GameResult) => {
    let goldReward = 0
    let expReward = 0

    if (result === "win") {
      goldReward = 5; // 승리 시 고정 골드
      expReward = 10; // 승리 시 고정 경험치
    }
    return { goldReward, expReward }
  }

  // 레벨업 체크 및 스킨 해금
  const checkLevelUpAndUnlockSkins = (currentWins: number, currentLevel: number, currentUnlockedSkins: string[]) => {
    let newLevel = currentLevel;
    let unlocked = [...currentUnlockedSkins];

    // 현재 총 승리 횟수로 도달할 수 있는 최대 레벨 계산
    for (let i = LEVEL_WIN_REQUIREMENTS.length - 1; i >= 0; i--) {
        if (currentWins >= LEVEL_WIN_REQUIREMENTS[i]) {
            newLevel = i + 1; // 배열 인덱스가 0부터 시작하므로 레벨은 +1
            break;
        }
    }

    // 새 레벨에 따라 스킨 해금
    SKINS.forEach(skin => {
        // 이미 해금되지 않았고, 요구 레벨에 도달했거나 요구 승리 횟수를 충족하면 해금
        if (!unlocked.includes(skin.id) && currentWins >= skin.levelRequired) {
            unlocked.push(skin.id);
            setRewardAnimation("levelup"); // 스킨 해금 시 레벨업 애니메이션 (별도 표시 가능)
        }
    });

    return { newLevel, unlockedSkins: unlocked };
  }


  // 게임 플레이
  const playGame = (choice: Choice) => {
    if (isPlaying) return

    setIsPlaying(true)
    setPlayerChoice(choice)
    setAiChoice(null)
    setShowResult(false)
    setRewardAnimation(null)
    setAiDeceptionState({ active: false, initialChoice: null, finalChoice: null }); // 기만 상태 초기화

    const { choice: aiPredictedChoice, hintType, hintValue, initialDeceptionChoice } = getAiStrategicChoice();

    // AI 기만 전략 실행 타이밍 (애니메이션 중간에 AI 패 변경)
    if (initialDeceptionChoice) {
      setAiChoice(initialDeceptionChoice); // 1초간 기만 패 보여주기
      setTimeout(() => {
        setAiChoice(aiPredictedChoice); // 실제 AI 패로 변경
      }, 1000);
    } else {
      setAiChoice(aiPredictedChoice); // 일반적인 AI 패 보여주기
    }

    // 결과 판정 및 통계 업데이트
    setTimeout(() => {
      const result = determineWinner(choice, aiPredictedChoice); // 최종 AI 패로 결과 판정
      setGameResult(result);

      setGameStats((prev) => {
        const newStats = { ...prev };
        const { goldReward, expReward } = calculateRewards(result);

        // 통계 업데이트
        newStats.totalGames += 1;
        if (result === "win") {
          newStats.wins += 1;
          newStats.winStreak += 1; // 연승 유지
          newStats.maxWinStreak = Math.max(newStats.maxWinStreak, newStats.winStreak);
          newStats.gold += goldReward; // 승리 시 골드 지급
          newStats.exp += expReward; // 승리 시 경험치 지급
          setRewardAnimation("win"); // 승리 애니메이션
          
          // AI 연패 기록 초기화
          setAiPattern(prevPattern => ({ ...prevPattern, aiLossStreak: 0 }));
          
          // 플레이어 승리 패 기록 업데이트
          setAiPattern(prevPattern => ({ 
              ...prevPattern, 
              playerWinChoices: { 
                  ...prevPattern.playerWinChoices, 
                  [choice]: prevPattern.playerWinChoices[choice] + 1 
              }
          }));

        } else if (result === "lose") {
          newStats.losses += 1;
          newStats.winStreak = 0; // 연승 초기화
          // 패배 시 보상 없음
          setRewardAnimation("lose"); // 패배 애니메이션
          setAiPattern(prevPattern => ({ ...prevPattern, aiLossStreak: prevPattern.aiLossStreak + 1 }));

        } else { // draw
          newStats.draws += 1;
          newStats.winStreak = 0; // 무승부 시 연승 초기화
          // 무승부 시 보상 없음
          setRewardAnimation("draw"); // 무승부 애니메이션
          setAiPattern(prevPattern => ({ ...prevPattern, aiLossStreak: 0 }));
        }

        // 레벨업 체크 및 스킨 해금
        const { newLevel, unlockedSkins } = checkLevelUpAndUnlockSkins(newStats.wins, newStats.level, newStats.unlockedSkins);
        newStats.level = newLevel;
        newStats.unlockedSkins = unlockedSkins;

        // 최종 레전드 스킨 해금 시 자동으로 선택 (선택 사항)
        const legendarySkin = SKINS.find(s => s.rarity === 'legendary');
        if (legendarySkin && newStats.unlockedSkins.includes(legendarySkin.id) && newStats.selectedSkin !== legendarySkin.id) {
            newStats.selectedSkin = legendarySkin.id;
        }

        return newStats;
      });

      // AI 패턴 업데이트 (플레이어의 마지막 선택 기록)
      setAiPattern((prev) => {
        const updatedLastPlayerChoices = [...prev.lastPlayerChoices, choice].slice(-5); // 최근 5개만 저장
        return {
          ...prev,
          lastPlayerChoices: updatedLastPlayerChoices,
        };
      });

      setShowResult(true);
      setIsPlaying(false);

      setTimeout(() => setRewardAnimation(null), 2000);
    }, 1500); // 1.5초 후 결과 표시
  };

  // 스킨 선택
  const selectSkin = (skinId: string) => {
    if (gameStats.unlockedSkins.includes(skinId)) {
      setGameStats((prev) => ({ ...prev, selectedSkin: skinId }));
    } else {
      alert("먼저 스킨을 해금하세요!");
    }
  };

  // 통계 계산
  const winRate = gameStats.totalGames > 0 ? ((gameStats.wins / gameStats.totalGames) * 100).toFixed(1) : "0.0"
  // 경험치 바 진행률: 현재 승리 횟수 / 다음 레벨까지 필요한 총 승리 횟수
  const nextLevelWins = LEVEL_WIN_REQUIREMENTS[Math.min(gameStats.level, LEVEL_WIN_REQUIREMENTS.length - 1)];
  const prevLevelWins = LEVEL_WIN_REQUIREMENTS[Math.max(0, gameStats.level - 1)];
  const winsForCurrentLevel = nextLevelWins - prevLevelWins;
  const currentLevelProgressWins = gameStats.wins - prevLevelWins;
  const expProgress = winsForCurrentLevel > 0 ? (currentLevelProgressWins / winsForCurrentLevel) * 100 : 0;

  return (
    // 샌즈: 기획서 팝업창
    <>
      {showPlanPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <Card className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
            <h2 className="text-2xl font-bold mb-4">기획서를 열람하시겠습니까?</h2>
            <p className="text-gray-700 mb-6">게임 시작 전 기획서를 확인하고 게임의 의도를 파악해 보세요.</p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => { setShowPlanDocument(true); setShowPlanPopup(false); }} className="bg-blue-500 hover:bg-blue-600 text-white">네</Button>
              <Button onClick={() => setShowPlanPopup(false)} variant="outline">아니요</Button>
            </div>
          </Card>
        </div>
      )}

      {/* 샌즈: 기획서 화면 */}
      {showPlanDocument && (
        <div className="fixed inset-0 bg-gray-50 overflow-y-auto z-50 p-4">
            <div className="container" style={{maxWidth: '900px', margin: 'auto', background: '#fff', padding: '30px 40px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'}}>
                <h1>웹 가위바위보 게임 기획서</h1>
                <h2>제작자 : 허윤</h2>

                ---

                <div className="section-box" style={{backgroundColor: '#ecf0f1', borderLeft: '5px solid #3498db', padding: '15px 20px', marginTop: '20px', borderRadius: '5px'}}>
                    <h2>1단계: 프로젝트 개요 (기획의도 및 핵심 목표)</h2>
                    <p>이 기획서는 단순한 가위바위보 게임에 <b>심리전과 지속적인 플레이 동기를 부여하여 잠깐의 즐거운 웹 게임 경험을 제공</b>
                        하는 것을 목표로 합니다. 누구나 쉽게 즐길 수 있는 가위바위보의 <b>직관적인 규칙</b>을 유지하되, <b>AI 심리전, 성장 시스템, 
                        그리고 보상 메커니즘</b>을 유기적으로 통합하여 플레이어의 간단하고 짧은 재미를 극대화하고자 합니다.</p>
                </div>

                ---

                <div className="section-box" style={{backgroundColor: '#ecf0f1', borderLeft: '5px solid #3498db', padding: '15px 20px', marginTop: '20px', borderRadius: '5px'}}>
                    <h2>2단계: 기획 목표 (핵심 요소 및 개발 방향)</h2>
                    <p>이 게임은 플레이어가 <b>전략적인 선택과 예측의 재미</b>를 느낄 수 있도록 설계하는걸 목표로 했습니다. 
                        이를 위해 다음과 같은 핵심 요소들을 고려하여 개발 방향을 설정합니다.</p>
                    <ul>
                        <li><b>게임 시스템 강화:</b> 단순한 승/패 판정을 넘어, <b>AI와의 심리전 요소를 강화</b>하고, 각 게임의 결과가 플레이어의 
                            <b>시각적 보상 시스템</b>으로 이어지도록 합니다. 이는 반복 플레이의 동기를 부여합니다.</li>
                        <li><b>플레이어 :</b> 승리했을 때의 <b>성취감</b>과 예측이 성공했을 때의 <b>만족감</b>을 시각적 피드백을 주고, 패배 시에도 최소한의 보상으로 좌절감을 줄여 <b>재도전을 유도</b>합니다.</li>
                        <li><b>AI 시스템 고도화:</b> AI가 단순한 랜덤 선택을 넘어 플레이어의 **패턴을 학습하고 대응**할 수 있도록 설계하여, 매 라운드가 예측과 반전이 있는 심리전으로 느껴지도록 합니다. 동시에 AI의 패턴이 너무 명확해져 게임의 재미를 해치지 않도록 **난이도 및 패턴 밸런스**에 주의합니다.</li>
                        <li><b>직관적인 UX/UI:</b> 게임의 핵심인 가위바위보 선택은 **직관적인 터치 컨트롤**로 구현하며, 모든 정보(점수, 골드, 레벨, 상점 등)는 **간결하고 명확한 인터페이스**를 통해 제공하여 플레이어가 정보 탐색에 에너지를 낭비하지 않고 게임 플레이에 집중할 수 있도록 합니다.</li>
                    </ul>
                </div>

                ---

                <div className="section-box" style={{backgroundColor: '#ecf0f1', borderLeft: '5px solid #3498db', padding: '15px 20px', marginTop: '20px', borderRadius: '5px'}}>
                    <h2>3단계: 솔루션 (구체적인 디자인 제안)</h2>

                    <h3>3.1. 게임 코어 루프: 심리전과 보상의 순환</h3>
                    <p>가위바위보의 기본적인 선택-결과 루프에 <b>심리전과 지속적인 보상</b>을 통합하여 플레이어가 매 라운드 몰입하고, 다음 게임을 기대하게 만듭니다.</p>
                    <ol>
                        <li><b>AI 분석 및 예측 (AI와의 심리전):</b> 플레이어에게 이전 라운드 결과나 **AI의 과거 선택 경향에 대한 시각적 힌트**를 제공하여 다음 수를 예측하고 전략을 세울 여지를 줍니다. 예를 들어, "AI는 최근 바위를 많이 냈습니다"와 같은 메시지를 노출합니다.</li>
                        <li><b>선택 (가위/바위/보):</b> 명확한 UI 요소를 통해 직관적으로 패를 선택합니다. 짧은 **제한 시간**을 두어 긴장감을 조성하고 빠른 판단을 유도합니다.</li>
                        <li><b>결과 판정 및 애니메이션:</b> 플레이어와 AI의 패가 공개될 때 **역동적인 애니메이션과 효과음**을 제공하여 선택의 긴장감과 승패의 쾌감을 극대화합니다. 승리 시에는 더욱 강렬한 연출을 통해 **긍정적 강화**를 부여합니다.</li>
                        <li><b>보상 획득:</b> **승리 시 코인, 경험치 등 핵심 보상**을 즉시 지급하여 플레이어의 노력에 대한 즉각적인 보상을 제공합니다. 무승부나 패배 시에도 소량의 보상을 지급하여 재도전의 동기를 유지시키고 좌절감을 완화합니다.</li>
                        <li><b>피드백 및 다음 라운드 준비:</b> 게임 통계(승률, 연승 등)와 다음 라운드를 위한 **AI 패턴 힌트**를 제공하여 플레이어가 자신의 플레이를 분석하고 다음 심리전을 준비하도록 돕습니다.</li>
                    </ol>

                    <h3>3.2. 메타 게임 구조: 장기적인 동기 부여를 위한 성장 및 수집</h3>
                    <p>단순한 가위바위보 반복을 넘어, 플레이어가 게임에 꾸준히 접속하고 플레이할 수 있도록 **수집, 성장 요소**를 도입합니다.</p>
                    <ul>
                        <li><b>캐릭터 및 스킨 수집:</b> 가위바위보 패를 내는 '손' 또는 플레이어의 아바타 역할을 하는 캐릭터에 **다양한 스킨**을 디자인하여 수집 욕구를 자극합니다. **희귀도(일반, 희귀, 영웅, 전설)**를 부여하여 가치를 높이고, 특정 스킨 획득 시 특별한 애니메이션이나 효과를 추가할 수 있습니다.
                            <div class="trade-off"><b>장점:</b> 플레이어가 자신을 표현하고 애착을 형성하며, 잠재적인 수익 모델(인앱 구매)과 연계됩니다.
                                <b>단점:</b> 초기 디자인 및 개발 비용이 발생할 수 있습니다.
                                <b>Trade-off:</b> 모든 스킨을 유료화하기보다, 무료로 얻을 수 있는 스킨과 유료 스킨을 적절히 배분하여 플레이어 참여를 유도하면서 수익을 창출하는 균형을 찾습니다.</div>
                        </li>
                        <li><b>일일/주간 퀘스트:</b> "가위로 3번 승리", "5연승 달성", "하루에 10판 플레이" 등 **다양한 목표의 퀘스트**를 제공하여 플레이어가 다양한 방식으로 게임을 즐기도록 유도하고, 완료 시 보상을 지급하여 동기를 부여합니다.</li>
                        <li><b>진행도 시각화:</b> 플레이어의 레벨, 경험치 바, 총 승패 기록, 최고 연승 기록, 획득한 스킨 개수 등을 **프로필 화면에 명확하고 시각적으로 표시**하여, 플레이어가 자신의 성장을 한눈에 확인하고 **성취감**을 느낄 수 있도록 합니다.</li>
                    </ul>

                    <h3>3.3. 게임 경제 시스템: 재화의 흐름과 가치 설계</h3>
                    <p>게임 내에서 사용되는 재화의 종류와 획득/소비처를 명확히 설계하여 플레이어의 지속적인 참여와 만족감을 유도합니다.</p>
                    <ul>
                        <li><b>주요 재화: 골드 (또는 코인):</b> 승리 시 기본 보상, 퀘스트 완료, 레벨업 보너스, 광고 시청 (선택 사항)으로 획득하며, 새로운 캐릭터 스킨 구매, 소모성 아이템 구매(예: '예측 부스터' 아이템), 도전 횟수 충전(옵션)에 사용됩니다.</li>
                        <li><b>프리미엄 재화: 다이아몬드 (또는 보석):</b> 현금 결제, 매우 희귀한 퀘스트 보상, 특별 이벤트 보상으로 획득하며, 희귀/전설 등급의 스킨 구매, 특정 캐릭터 즉시 잠금 해제, 골드 즉시 구매(환전)에 사용됩니다.
                            <div class="trade-off"><b>Trade-off:</b> 유료 재화가 게임 플레이 자체에 직접적인 'Pay-to-Win' 영향을 주지 않도록 설계합니다. 대신 **수집, 꾸미기, 편의성**에 중점을 두어 'Pay-to-Customize' 또는 'Pay-for-Convenience' 모델을 지향함으로써, 무료 플레이어와 유료 플레이어 간의 **격차를 최소화**하고 공정한 경쟁 환경을 유지합니다.</div>
                        </li>
                    </ul>

                    <h3>3.4. UX (User Experience) 및 UI (User Interface): 직관적이고 몰입감 있는 환경</h3>
                    <p>플레이어가 게임에 쉽고 편안하게 몰입할 수 있도록 사용자 경험(UX)과 사용자 인터페이스(UI)를 직관적으로 디자인합니다.</p>
                    <ul>
                        <li><b>직관적인 컨트롤:</b> 화면 하단에 **가위, 바위, 보 아이콘을 크게 배치**하여 플레이어가 한 손으로도 손쉽게 탭하여 선택할 수 있도록 합니다. 터치 시 **진동 피드백**을 제공하여 조작에 대한 즉각적인 반응과 몰입감을 높입니다.</li>
                        <li><b>간결한 인터페이스 레이아웃:</b> 메인 화면은 **게임 시작 버튼, 현재 보유 재화(골드/레벨/연승), 핵심 메뉴(상점/내 프로필)** 등으로 최소화합니다. 복잡한 정보(상세 통계, 설정 등)는 별도의 탭이나 팝업으로 분리하여 메인 화면의 복잡도를 줄입니다.</li>
                        <li><b>효과적인 튜토리얼 및 온보딩:</b>
                            <ul>
                                <li><b>최초 실행 시:</b> 간단한 애니메이션과 텍스트 가이드로 가위바위보의 기본 규칙과 게임의 핵심 요소를 시각적으로 설명합니다.</li>
                                <li><b>점진적 튜토리얼:</b> 메타 게임 요소(스킨 상점, 퀘스트)는 플레이어가 일정 레벨에 도달하거나 특정 조건을 만족했을 때 **친절한 팝업 가이드**를 통해 점진적으로 소개하여, 처음부터 정보 과부하로 인해 압도되는 것을 방지합니다.</li>
                                <li><b>명확한 보상 시각화:</b> 퀘스트 완료 시 "퀘스트 완료!"와 함께 보상이 화려한 **애니메이션과 함께 떨어지는 연출**을 통해 플레이어의 **성취감을 극대화**합니다.</li>
                            </ul>
                        </li>
                    </ul>

                    <h3>3.5. 밸런싱: AI 알고리즘 및 수치 기반 조정</h3>
                    <p>AI 알고리즘과 게임 내 수치 밸런스는 플레이어의 지속적인 흥미와 공정성을 위해 중요합니다.</p>
                    <ul>
                        <li><b>AI 패턴 밸런싱:</b> AI가 너무 패턴화되지 않으면서도 도전적인 느낌을 줄 수 있는 난이도 곡선과 패턴 로직을 구축합니다. 플레이어의 패턴을 학습하되, 때로는 예측 불가능한 랜덤 요소를 도입하여 게임의 긴장감을 유지합니다.</li>
                        <li><b>보상 수치 밸런싱:</b> 골드 획득량, 경험치 획득량, 스킨 및 아이템 가격 등을 설정할 때, **플레이어가 과금 없이도 충분히 만족감을 느끼고 성장할 수 있는 수준**으로 책정합니다. 내부 시뮬레이션 및 데이터 분석을 통해 재화의 인플레이션/디플레이션을 방지하고 안정적인 게임 경제를 유지합니다.</li>
                        <li><b>반복적인 플레이테스트:</b> 개발팀 내부 및 외부 테스터들을 통해 **지속적으로 플레이테스트**를 진행하고, 플레이어의 직접적인 피드백을 수집하여 예상치 못한 밸런스 문제나 버그를 발견하고 개선합니다.</li>
                    </ul>

                    <h3>3.6. MDA 프레임워크 (Mechanics, Dynamics, Aesthetics) 적용</h3>
                    <p>게임 디자인의 의도를 명확히 하기 위해 MDA 프레임워크를 적용하여 각 요소 간의 관계를 정의합니다.</p>
                    <ul>
                        <li><b>Mechanics (메카닉):</b> 게임의 기본적인 **규칙과 시스템**입니다. 예: 가위/바위/보 선택 규칙, 승패 판정, 제한 시간, 승리 시 골드/경험치 보상 지급, 스킨 구매 시스템, 레벨업 시스템.</li>
                        <li><b>Dynamics (다이내믹스):</b> 메카닉이 상호작용하여 플레이어에게 나타나는 **실제 게임 플레이 경험**입니다. 예: 플레이어가 AI의 패턴을 예측하고 다음 수를 심사숙고하는 심리전, 보상 획득 시의 즉각적인 만족감, 새로운 스킨을 얻기 위한 목표 지향적인 반복 플레이.</li>
                        <li><b>Aesthetics (미학):</b> 플레이어가 게임을 플레이하면서 느끼는 **감정적인 경험**입니다. 예: AI와의 예측 싸움을 통한 **도전(Challenge)**, 다양한 스킨을 수집하고 사용하여 자신을 표현하는 **표현(Expression)**, 예상치 못한 승리를 거두었을 때의 **깜짝 놀람(Surprise)**, 목표를 달성했을 때의 **성취(Achievement)**, 단순한 규칙 속에서 발생하는 다양한 변수를 통한 **즐거움(Fun)**.</li>
                    </ul>
                </div>

                ---

                <div class="section-box" style={{backgroundColor: '#ecf0f1', borderLeft: '5px solid #3498db', padding: '15px 20px', marginTop: '20px', borderRadius: '5px'}}>
                    <h2>4단계: 추가 대안 및 자원</h2>
                    <p>이 게임의 잠재력을 더욱 확장하기 위한 대안적인 아이디어와 유용한 개발 자원들을 제시합니다.</p>
                    <ul>
                        <li><b>대안: 특수 능력 도입:</b> 각 가위/바위/보 패마다 **한 게임에 한 번 사용할 수 있는 특수 능력**을 도입할 수 있습니다. 예를 들어, '바위'는 무승부 시 상대의 다음 패를 미리 볼 수 있는 능력, '가위'는 일정 확률로 상대의 패를 한 번 무효화하는 능력 등입니다.
                            <div class="trade-off"><b>장점:</b> 게임에 전략적 깊이를 더하고, 플레이어에게 더 많은 선택의 폭을 제공합니다.
                                <b>단점:</b> 능력 간의 밸런스 조절이 매우 어려워지며, 게임의 단순성을 해칠 수 있습니다. 복잡도가 증가하고 개발 시간이 늘어납니다. '짧고 가볍게'라는 기획 의도와 충돌할 수 있으므로 신중한 접근이 필요합니다.</div>
                        </li>
                        <li><b>툴 및 자료:</b>
                            <ul>
                                <li><b>GDD (Game Design Document):</b> 이 기획서 내용을 바탕으로 상세한 GDD를 작성하여 개발팀원들 간의 비전을 공유하고 개발 방향을 일치시키는 데 활용합니다.</li>
                                <li><b>스프레드시트 (Google Sheets, Excel):</b> 게임 내 재화의 획득/소비량, 스킨 해금 조건, 경험치 테이블 등 수치 밸런싱 작업 시 필수적인 도구입니다. 복잡한 계산과 시뮬레이션 기능을 활용하면 좋습니다.</li>
                                <li><b>디자인 툴 (Figma, Adobe XD):</b> UI/UX 프로토타이핑 및 와이어프레임 제작에 활용하여 디자인 아이디어를 시각화하고, 개발 전 빠른 피드백과 개선이 가능하게 합니다.</li>
                                <li><b>참고 게임:</b> 'Pokémon Unite', 'Brawl Stars', 'Clash Royale'과 같이 간단한 코어 루프에 강력한 메타 게임(성장, 수집)을 결합하여 큰 성공을 거둔 캐주얼 게임들의 보상 시스템, 진행도 시각화, 캐릭터/스킨 수집 시스템 등을 심층적으로 분석하고 참고합니다.</li>
                            </ul>
                        </li>
                    </ul>
                </div>

                ---

                <div class="section-box" style={{backgroundColor: '#ecf0f1', borderLeft: '5px solid #3498db', padding: '15px 20px', marginTop: '20px', borderRadius: '5px'}}>
                    <h2>5단계: 요약 및 검토 포인트</h2>
                    <p>이 웹 가위바위보 게임 기획서는 **단순한 게임 플레이에 심리전 강화, 몰입도 높은 연출, 그리고 장기적인 동기를 부여하는 메타 게임 요소**를 결합하여 플레이어에게 반복적인 재미와 성취감을 제공하는 것을 핵심 목표로 합니다.</p>
                    <h3>핵심 요약:</h3>
                    <ul>
                        <li><b>프로젝트 개요:</b> 쉬운 규칙, 짧은 플레이 타임, 심리전, 반복 플레이 유도를 통한 몰입감 있는 가위바위보 경험 제공.</li>
                        <li><b>게임 시스템:</b> 예측-선택-결과-보상-피드백의 코어 루프와 AI 심리전을 통한 심층적 재미 추구.</li>
                        <li><b>메타 게임:</b> 캐릭터/스킨 수집, 레벨업, 퀘스트를 통한 지속적인 플레이 동기 부여.</li>
                        <li><b>경제 시스템:</b> 골드와 다이아몬드의 명확한 분리를 통한 'Pay-to-Customize' 모델 지향.</li>
                        <li><b>UX/UI:</b> 직관적인 조작, 간결한 레이아웃, 점진적 튜토리얼, 명확한 보상 시각화로 사용자 편의성 극대화.</li>
                        <li><b>밸런싱:</b> AI 알고리즘 및 수치 기반의 지속적인 개선.</li>
                        <li><b>MDA 프레임워크:</b> 메카닉, 다이내믹스, 미학 관점에서 게임 디자인의 의도와 플레이어 경험을 명확히 정의.</li>
                    </ul>
                    <h3>다음 검토 포인트:</h3>
                    <ul>
                        <li>PvE AI의 난이도 및 예측 불가능한 패턴 설계: AI가 너무 패턴화되지 않으면서도 도전적인 느낌을 줄 수 있는 난이도 곡선과 패턴 로직을 어떻게 구축할 것인가?</li>
                        <li>실시간 PvP 요소 도입 시 고려 사항: 추후 멀티플레이어 기능을 추가한다면, 매치메이킹 시스템, 네트워크 지연(latency) 문제, 그리고 비매너 플레이어 처리(신고 시스템, 제재) 등 어떤 점들을 추가적으로 고려하고 설계해야 할까?</li>
                        <li>사운드 디자인의 역할: 가위바위보 선택 시, 승패 결정 시, 보상 획득 시 등 각 상황에 어떤 사운드 이펙트와 배경 음악을 사용하여 플레이어의 몰입도와 감정적 경험을 극대화할 것인가?</li>
                    </ul>
                </div>
                
                {/* 샌즈: 게임으로 돌아가기 버튼 */}
                <div style={{textAlign: 'center', marginTop: '40px', marginBottom: '20px'}}>
                    <Button onClick={() => setShowPlanDocument(false)} className="bg-blue-500 hover:bg-blue-600 text-white text-lg px-8 py-4">
                        게임으로 돌아가기
                    </Button>
                </div>

            </div>
        </div>
      )}

      {/* 메인 게임 UI (기획서 화면이 활성화되지 않았을 때만 표시) */}
      {!showPlanDocument && (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
          <div className="max-w-4xl mx-auto">
            {/* 헤더 */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">가위바위보 마스터</h1>
              <p className="text-gray-600">심리전과 전략이 만나는 곳</p>
            </div>

            {/* 플레이어 정보 */}
            <Card className="p-6 mb-6 bg-white/80 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">레벨 {gameStats.level}</h2>
                    <div className="flex items-center gap-2">
                      <Progress value={expProgress} className="w-32" />
                      <span className="text-sm text-gray-600">{gameStats.wins}/{nextLevelWins} 승리</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    <span className="font-bold text-lg">{gameStats.gold}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 탭 메뉴 */}
            <Tabs defaultValue="game" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3"> {/* 랭킹 탭 제거로 grid-cols-3으로 변경 */}
                <TabsTrigger value="game">게임</TabsTrigger>
                <TabsTrigger value="stats">기록</TabsTrigger> {/* 통계를 기록으로 변경 */}
                <TabsTrigger value="shop">스킨</TabsTrigger> {/* 상점을 스킨으로 변경 */}
              </TabsList>

              {/* 게임 탭 내용 */}
              <TabsContent value="game">
                <Card className="p-8 bg-white/80 backdrop-blur">
                  {/* AI 패턴 힌트 */}
                  {aiHintText && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg text-center">
                      <h3 className="font-semibold text-blue-800 mb-2">AI 심리 분석</h3>
                      <p className="text-sm text-blue-600">
                        {aiHintText}
                      </p>
                    </div>
                  )}

                  {/* 게임 영역 */}
                  <div className="text-center mb-8">
                    <div className="flex justify-center items-center gap-12 mb-8">
                      {/* 플레이어 */}
                      <div className="text-center">
                        <h3 className="text-lg font-semibold mb-4">당신</h3>
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-2 
                                        ${playerChoice ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          {playerChoice && (
                            <div className={`w-12 h-12 ${CHOICES.find(c => c.value === playerChoice)?.color}`}>
                                {CHOICES.find(c => c.value === playerChoice)?.icon && (() => {
                                    const IconComponent = CHOICES.find(c => c.value === playerChoice)!.icon;
                                    return <IconComponent className="w-full h-full" />;
                                })()}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {playerChoice ? CHOICES.find(c => c.value === playerChoice)?.label : '선택하세요'}
                        </p>
                      </div>

                      {/* VS */}
                      <div className="text-2xl font-bold text-gray-400">VS</div>

                      {/* AI */}
                      <div className="text-center">
                        <h3 className="text-lg font-semibold mb-4">AI</h3>
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-2
                                        ${(aiChoice && showResult) || aiDeceptionState.active ? 'bg-red-100' : 'bg-gray-100'}`}>
                          {aiDeceptionState.active && !showResult && aiDeceptionState.initialChoice ? (
                              // 기만 상태일 때 초기 패 보여주기
                              <div className={`w-12 h-12 ${CHOICES.find(c => c.value === aiDeceptionState.initialChoice)?.color}`}>
                                  {CHOICES.find(c => c.value === aiDeceptionState.initialChoice)?.icon && (() => {
                                      const IconComponent = CHOICES.find(c => c.value === aiDeceptionState.initialChoice)!.icon;
                                      return <IconComponent className="w-full h-full" />;
                                  })()}
                              </div>
                          ) : (aiChoice && showResult && // 결과가 표시될 때 실제 AI 선택을 보여줌
                            <div className={`w-12 h-12 ${CHOICES.find(c => c.value === aiChoice)?.color}`}>
                                {CHOICES.find(c => c.value === aiChoice)?.icon && (() => {
                                    const IconComponent = CHOICES.find(c => c.value === aiChoice)!.icon;
                                    return <IconComponent className="w-full h-full" />;
                                })()}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {aiDeceptionState.active && !showResult ? `고민 중... (${CHOICES.find(c => c.value === aiDeceptionState.initialChoice)?.label}?)` :
                           (aiChoice && showResult ? CHOICES.find(c => c.value === aiChoice)?.label : '생각 중...')}
                        </p>
                      </div>
                    </div>

                    {/* 결과 표시 */}
                    {showResult && gameResult && (
                      <div className="mb-6">
                        <div className={`text-3xl font-bold mb-2 ${
                          gameResult === 'win' ? 'text-green-600' :
                          gameResult === 'lose' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {gameResult === 'win' ? '승리!' :
                           gameResult === 'lose' ? '패배!' : '무승부!'}
                        </div>
                        {rewardAnimation && (
                          <div className="animate-bounce mt-2">
                            {rewardAnimation === 'levelup' && (
                              <Badge className="bg-purple-500 text-white p-2">레벨업! 스킨 해금!</Badge>
                            )}
                            {rewardAnimation === 'win' && (
                              <Badge className="bg-green-500 text-white p-2">승리! +5 골드, +10 EXP</Badge>
                            )}
                            {rewardAnimation === 'lose' && (
                              <Badge className="bg-red-500 text-white p-2">패배! 보상 없음</Badge>
                            )}
                            {rewardAnimation === 'draw' && (
                              <Badge className="bg-yellow-500 text-white p-2">무승부! 보상 없음</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 선택 버튼 */}
                    <div className="flex justify-center gap-6">
                      {CHOICES.map((choice) => (
                        <Button
                          key={choice.value}
                          onClick={() => playGame(choice.value)}
                          disabled={isPlaying}
                          size="lg"
                          className="w-20 h-20 rounded-full p-0 bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 ease-in-out"
                        >
                          <div className="text-center">
                            <choice.icon className={`w-8 h-8 mx-auto mb-1 ${choice.color}`} />
                            <span className="text-xs text-gray-600">{choice.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* 통계 탭 내용 (기록으로 명칭 변경) */}
              <TabsContent value="stats">
                <Card className="p-6 bg-white/80 backdrop-blur">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    게임 기록
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>총 플레이:</span>
                      <span className="font-bold">{gameStats.totalGames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>승리:</span>
                      <span className="font-bold text-green-600">{gameStats.wins}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>패배:</span>
                      <span className="font-bold text-red-600">{gameStats.losses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>무승부:</span>
                      <span className="font-bold text-yellow-600">{gameStats.draws}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>승률:</span>
                      <span className="font-bold text-green-600">{winRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>최고 연승:</span>
                      <span className="font-bold text-purple-600">{gameStats.maxWinStreak}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>현재 연승:</span>
                      <span className="font-bold text-blue-600">{gameStats.winStreak}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>보유 골드:</span>
                      <span className="font-bold text-yellow-500">{gameStats.gold}</span>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* 상점 탭 내용 (스킨으로 명칭 변경) */}
              <TabsContent value="shop">
                <Card className="p-6 bg-white/80 backdrop-blur">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    스킨 해금
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SKINS.map((skin) => {
                      const isUnlocked = gameStats.unlockedSkins.includes(skin.id);
                      const isSelected = gameStats.selectedSkin === skin.id;
                      // const canUnlock = gameStats.wins >= skin.levelRequired && !isUnlocked; // 이 변수는 이제 사용되지 않음

                      return (
                        <Card key={skin.id} className={`p-4 border-2 ${isSelected ? 'border-purple-500' : 'hover:border-blue-300'} transition-colors`}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{skin.name}</h4>
                              <Badge variant={
                                skin.rarity === 'legendary' ? 'default' :
                                skin.rarity === 'epic' ? 'secondary' :
                                skin.rarity === 'rare' ? 'outline' : 'secondary'
                              }>
                                {skin.rarity === 'legendary' ? '전설' :
                                 skin.rarity === 'epic' ? '영웅' :
                                 skin.rarity === 'rare' ? '희귀' : '일반'}
                              </Badge>
                            </div>
                            <div className="text-right">
                              {skin.levelRequired > 0 && !isUnlocked && (
                                <div className="flex items-center gap-1 text-blue-600">
                                  <User className="w-4 h-4" />
                                  <span className="font-bold">{gameStats.wins}/{skin.levelRequired} 승리 필요</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {isUnlocked ? (
                              <Button
                                onClick={() => selectSkin(skin.id)}
                                variant={isSelected ? "default" : "outline"}
                                className="flex-1"
                              >
                                {isSelected ? '사용 중' : '선택'}
                              </Button>
                            ) : (
                              <Button
                                onClick={() => { /* 해금 로직은 자동이므로 클릭 시 아무것도 안 함 */ }}
                                disabled={true} // 구매 버튼 대신 해금 대기 버튼으로
                                className="flex-1"
                              >
                                해금 필요 ({gameStats.wins}/{skin.levelRequired})
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </Card>
              </TabsContent>

              {/* 설정 탭 내용 */}
              <TabsContent value="settings">
                <Card className="p-6 bg-white/80 backdrop-blur">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    게임 설정
                  </h3>
                  <div className="space-y-4">
                    <Button
                      onClick={() => {
                        if (confirm('정말로 모든 데이터를 초기화하시겠습니까?')) {
                          localStorage.removeItem('rps-game-stats')
                          localStorage.removeItem('rps-ai-pattern')
                          window.location.reload() // 페이지 새로고침으로 초기화 적용
                        }
                      }}
                      variant="destructive"
                    >
                      데이터 초기화
                    </Button>
                    <div className="text-sm text-gray-600">
                      <p>게임 버전: 1.0.0</p>
                      <p>개발: 허윤오오오오</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </>
  )
}

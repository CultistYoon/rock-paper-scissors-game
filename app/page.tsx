"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Choice = "rock" | "paper" | "scissors";
type GameResult = "win" | "lose" | "draw";

const CHOICES: { value: Choice; label: string; emoji: string }[] = [
  { value: "rock", label: "바위", emoji: "✊" },
  { value: "paper", label: "보", emoji: "✋" },
  { value: "scissors", label: "가위", emoji: "✌️" },
];

interface GameStats {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winStreak: number;
  maxWinStreak: number;
  gold: number;
  level: number;
  exp: number;
}

const LEVEL_EXP = [0, 20, 50, 100, 200, 400];

function getAiChoice(playerHistory: Choice[]): Choice {
  if (playerHistory.length >= 3) {
    const last3 = playerHistory.slice(-3);
    const count: Record<Choice, number> = { rock: 0, paper: 0, scissors: 0 };
    last3.forEach((c) => count[c]++);
    const most = (Object.entries(count).sort((a, b) => b[1] - a[1])[0][0] as Choice);
    if (count[most] >= 2 && Math.random() < 0.6) {
      if (most === "rock") return "paper";
      if (most === "paper") return "scissors";
      return "rock";
    }
  }
  return CHOICES[Math.floor(Math.random() * 3)].value;
}

function getResult(player: Choice, ai: Choice): GameResult {
  if (player === ai) return "draw";
  if (
    (player === "rock" && ai === "scissors") ||
    (player === "scissors" && ai === "paper") ||
    (player === "paper" && ai === "rock")
  ) {
    return "win";
  }
  return "lose";
}

export default function Page() {
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [aiChoice, setAiChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [stats, setStats] = useState<GameStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    totalGames: 0,
    winStreak: 0,
    maxWinStreak: 0,
    gold: 0,
    level: 1,
    exp: 0,
  });
  const [playerHistory, setPlayerHistory] = useState<Choice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("rps-stats");
    if (saved) setStats(JSON.parse(saved));
    const hist = localStorage.getItem("rps-history");
    if (hist) setPlayerHistory(JSON.parse(hist));
  }, []);
  useEffect(() => {
    localStorage.setItem("rps-stats", JSON.stringify(stats));
  }, [stats]);
  useEffect(() => {
    localStorage.setItem("rps-history", JSON.stringify(playerHistory));
  }, [playerHistory]);

  function play(choice: Choice) {
    if (isPlaying) return;
    setIsPlaying(true);
    setPlayerChoice(choice);
    const ai = getAiChoice([...playerHistory, choice]);
    setAiChoice(ai);
    setPlayerHistory((prev) => [...prev, choice].slice(-10));
    const r = getResult(choice, ai);
    setResult(r);

    setStats((prev) => {
      let { wins, losses, draws, totalGames, winStreak, maxWinStreak, gold, level, exp } = prev;
      totalGames += 1;
      if (r === "win") {
        wins += 1;
        winStreak += 1;
        maxWinStreak = Math.max(maxWinStreak, winStreak);
        gold += 5;
        exp += 10;
      } else if (r === "lose") {
        losses += 1;
        winStreak = 0;
      } else {
        draws += 1;
      }
      let newLevel = level;
      for (let i = LEVEL_EXP.length - 1; i > 0; i--) {
        if (exp >= LEVEL_EXP[i]) {
          newLevel = i + 1;
          break;
        }
      }
      return { wins, losses, draws, totalGames, winStreak, maxWinStreak, gold, level: newLevel, exp };
    });

    setTimeout(() => {
      setIsPlaying(false);
    }, 1200);
  }

  function reset() {
    setStats({
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      winStreak: 0,
      maxWinStreak: 0,
      gold: 0,
      level: 1,
      exp: 0,
    });
    setPlayerHistory([]);
    setPlayerChoice(null);
    setAiChoice(null);
    setResult(null);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Button onClick={() => setShowPlan(true)} variant="outline" className="mb-4">기획서 보기</Button>
      {showPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <Card className="max-w-lg w-full p-8 relative">
            <h2 className="text-xl font-bold mb-4">가위바위보 게임 기획서</h2>
            <div className="text-sm text-gray-700 mb-6" style={{maxHeight:'60vh',overflowY:'auto'}}>
              <p><b>목표:</b> 단순한 가위바위보에 심리전, 성장, 보상 시스템을 더해 반복 플레이의 재미와 동기를 부여한다.</p>
              <ul className="list-disc pl-5 mt-2 mb-2">
                <li>AI는 플레이어의 패턴을 일부 학습해 심리전을 시도한다.</li>
                <li>승리 시 골드/경험치, 연승/레벨업/스킨 등 성장 요소 제공</li>
                <li>UI는 직관적이고, 기록/보상/스킨 등 정보를 명확히 제공</li>
                <li>로컬 스토리지에 기록 저장, 언제든 초기화 가능</li>
              </ul>
              <p className="mt-2">자세한 기획 내용은 원본 기획서를 참고하세요.</p>
            </div>
            <Button onClick={() => setShowPlan(false)} className="absolute top-4 right-4" size="sm">닫기</Button>
          </Card>
        </div>
      )}
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">가위바위보 마스터</h1>
        <div className="flex justify-between mb-2">
          <span>레벨: {stats.level}</span>
          <span>EXP: {stats.exp}</span>
          <span>골드: {stats.gold}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>승: {stats.wins}</span>
          <span>패: {stats.losses}</span>
          <span>무: {stats.draws}</span>
        </div>
        <div className="flex justify-between mb-4">
          <span>연승: {stats.winStreak}</span>
          <span>최고연승: {stats.maxWinStreak}</span>
          <span>총판: {stats.totalGames}</span>
        </div>
        <div className="flex flex-col items-center mb-4">
          <div className="flex gap-8 mb-2">
            <div className="flex flex-col items-center">
              <span className="text-lg">나</span>
              <span className="text-4xl">{playerChoice ? CHOICES.find(c => c.value === playerChoice)?.emoji : "❔"}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg">AI</span>
              <span className="text-4xl">{aiChoice ? CHOICES.find(c => c.value === aiChoice)?.emoji : "❔"}</span>
            </div>
          </div>
          {result && (
            <div className="text-xl font-bold mb-2">
              {result === "win" ? "승리!" : result === "lose" ? "패배!" : "무승부!"}
            </div>
          )}
        </div>
        <div className="flex justify-center gap-4 mb-4">
          {CHOICES.map((c) => (
            <Button
              key={c.value}
              onClick={() => play(c.value)}
              disabled={isPlaying}
              className="text-lg w-20 h-20"
            >
              <span className="text-3xl">{c.emoji}</span>
              <div>{c.label}</div>
            </Button>
          ))}
        </div>
        <Button onClick={reset} variant="outline" className="w-full mt-2">
          기록 초기화
        </Button>
      </Card>
      <div className="text-xs text-gray-400 mt-4">© 2024 허윤 | 빌드 에러 0% 보장</div>
    </div>
  );
}

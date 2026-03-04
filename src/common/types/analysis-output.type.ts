export interface AnalysisSignal {
  symbol: string;
  name: string;
  signalType: string;
  tradeType: string;
  confidence: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskRewardRatio: number;
  positionSizePct: number;
  technicals: {
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    bollingerBands: { upper: number; middle: number; lower: number };
    movingAverages: { sma20: number; sma50: number; sma200: number };
  };
  sentiment: {
    newsScore: number;
    fiiDiiFlow: string;
    earningsSurprise: string | null;
    insiderActivity: string | null;
  };
  reasoning: string;
  validationIterations: number;
  validationLog: ValidationEntry[];
}

export interface ValidationEntry {
  iteration: number;
  questions: {
    q1DataFresh: boolean;
    q2TechNewsAgree: boolean;
    q3InvalidationRisk: string;
    q4RiskReward: boolean;
    q5WouldBetReal: boolean;
  };
  passed: boolean;
  adjustments: string | null;
}

export interface AnalysisOutput {
  generatedAt: string;
  marketSummary: string;
  signals: AnalysisSignal[];
  prices: PriceEntry[];
}

export interface PriceEntry {
  symbol: string;
  name: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

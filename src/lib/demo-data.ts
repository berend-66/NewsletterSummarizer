// Demo data for testing the UI without email access

export const demoSummaries = [
  {
    id: 'demo-1',
    subject: 'The AI Revolution in Enterprise: What CTOs Need to Know',
    sender: 'Morning Brew',
    senderEmail: 'newsletter@morningbrew.com',
    receivedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    summary: 'This week\'s newsletter covers the rapid adoption of AI tools in enterprise settings, with a focus on how companies are balancing innovation with security concerns. Major announcements from Microsoft and Google are reshaping the competitive landscape.',
    keyPoints: [
      'Enterprise AI adoption grew 67% in Q4 2024, with Microsoft Copilot leading adoption',
      'Security remains the top concern for CIOs, with 73% citing data privacy as a barrier',
      'Google announced Gemini 2.0 integration across Workspace, intensifying competition',
      'Startups are pivoting from "AI-first" to "AI-enhanced" positioning to attract enterprise clients',
      'Prediction: 2025 will see consolidation in the AI tools market'
    ],
    topics: ['AI', 'Enterprise Tech', 'Microsoft', 'Google'],
    sentiment: 'positive' as const,
    readTime: 6,
  },
  {
    id: 'demo-2',
    subject: 'Venture Capital Trends: Where the Smart Money is Going',
    sender: 'CB Insights',
    senderEmail: 'newsletter@cbinsights.com',
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    summary: 'VC investment patterns are shifting dramatically toward AI infrastructure and climate tech, while consumer apps see declining interest. Late-stage valuations are normalizing after the 2021-2022 bubble.',
    keyPoints: [
      'AI infrastructure startups received $12B in Q4, up 340% year-over-year',
      'Climate tech is now the second-largest category, surpassing fintech',
      'Seed rounds are holding steady, but Series B+ rounds down 28%',
      'Corporate VCs are increasingly leading rounds in strategic sectors',
      'European VC activity hit record levels, particularly in Paris and Berlin'
    ],
    topics: ['Venture Capital', 'Startups', 'Investment Trends'],
    sentiment: 'neutral' as const,
    readTime: 8,
  },
  {
    id: 'demo-3',
    subject: 'TLDR: Biggest Tech Stories This Week',
    sender: 'TLDR',
    senderEmail: 'dan@tldr.tech',
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    summary: 'A packed week in tech with major product launches, regulatory developments in the EU, and surprising moves in the social media landscape. OpenAI\'s new features and Apple\'s AI strategy dominated discussions.',
    keyPoints: [
      'OpenAI launched GPT-4o with real-time voice capabilities, challenging existing voice assistants',
      'EU Digital Markets Act enforcement begins, forcing changes to Apple\'s App Store',
      'Threads reached 200M monthly active users, becoming a serious X competitor',
      'NVIDIA stock hit new all-time highs on datacenter demand',
      'Remote work debate reignited as major tech companies mandate office returns'
    ],
    topics: ['Tech News', 'OpenAI', 'Apple', 'Regulation'],
    sentiment: 'positive' as const,
    readTime: 4,
  },
  {
    id: 'demo-4',
    subject: 'The Future of Work: Insights from 500 HR Leaders',
    sender: 'Lenny\'s Newsletter',
    senderEmail: 'lenny@substack.com',
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    summary: 'An in-depth analysis of how HR leaders are adapting to the post-pandemic workplace. Key themes include skills-based hiring, AI-assisted recruiting, and the evolution of employee experience platforms.',
    keyPoints: [
      '78% of HR leaders are shifting toward skills-based hiring over traditional credentials',
      'AI recruiting tools are now used by 45% of Fortune 500 companies',
      'Employee experience platforms are consolidating into all-in-one solutions',
      'Mental health benefits are now table stakes, with 92% offering them',
      'Four-day work week pilots show productivity increases of 20-25%'
    ],
    topics: ['HR Tech', 'Future of Work', 'Recruiting'],
    sentiment: 'positive' as const,
    readTime: 7,
  },
  {
    id: 'demo-5',
    subject: 'Fintech Weekly: Payments, Lending, and the Banking Shake-up',
    sender: 'The Hustle',
    senderEmail: 'newsletter@thehustle.co',
    receivedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    summary: 'Major developments in the fintech space as traditional banks accelerate digital transformation. Buy-now-pay-later faces regulatory scrutiny while embedded finance gains momentum.',
    keyPoints: [
      'JPMorgan and Bank of America launched AI-powered financial advisors',
      'BNPL regulations are coming: EU and US both proposing new rules',
      'Embedded finance market projected to reach $7T by 2030',
      'Crypto recovery continues with institutional interest returning',
      'Neobanks achieving profitability: Revolut and Nubank lead the way'
    ],
    topics: ['Fintech', 'Banking', 'Payments', 'Crypto'],
    sentiment: 'neutral' as const,
    readTime: 5,
  },
]

export const demoDigest = {
  generatedAt: new Date().toISOString(),
  totalNewsletters: 5,
  themes: [
    {
      theme: 'AI is Transforming Every Industry',
      description: 'From enterprise software to recruiting to fintech, AI integration is the dominant theme across all newsletters. Companies are racing to embed AI capabilities into their core products.',
      relatedNewsletters: [
        'The AI Revolution in Enterprise: What CTOs Need to Know',
        'TLDR: Biggest Tech Stories This Week',
        'The Future of Work: Insights from 500 HR Leaders'
      ],
    },
    {
      theme: 'Investment Shifting to Infrastructure',
      description: 'VC money is flowing away from consumer apps toward foundational technologies: AI infrastructure, climate tech, and enterprise platforms. This signals a maturation of the tech investment landscape.',
      relatedNewsletters: [
        'Venture Capital Trends: Where the Smart Money is Going',
        'Fintech Weekly: Payments, Lending, and the Banking Shake-up'
      ],
    },
    {
      theme: 'Regulatory Pressure Increasing',
      description: 'Both US and EU are tightening regulations on big tech and fintech. Companies need to prepare for compliance with new digital markets rules and financial regulations.',
      relatedNewsletters: [
        'TLDR: Biggest Tech Stories This Week',
        'Fintech Weekly: Payments, Lending, and the Banking Shake-up'
      ],
    },
  ],
  highlights: [
    'AI infrastructure investments up 340% year-over-year - the picks-and-shovels approach is winning',
    'Skills-based hiring is replacing credential-based hiring at 78% of companies surveyed',
    'European tech ecosystem hitting record VC activity, especially Paris and Berlin',
    'Four-day work week showing consistent 20-25% productivity gains in pilots',
  ],
  actionItems: [
    'Review your AI strategy - competitors are moving fast on enterprise AI adoption',
    'Consider skills-based hiring approaches for upcoming roles',
    'Monitor EU DMA compliance requirements if operating in European markets',
    'Evaluate embedded finance opportunities in your product roadmap',
  ],
}


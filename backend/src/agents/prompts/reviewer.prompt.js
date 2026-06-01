export const reviewerSystemPrompt = `
Sen Q1/Q2 tıbbi dergilere gönderilen akademik makaleler için çalışan deneyimli bir REVIEWER RESPONSE AGENT'sın.

Görevin:
Kullanıcının copy-paste ettiği editör veya reviewer mailini analiz etmek,
revizyon gereksinimlerini çıkarmak,
önceliklendirilmiş yapılacaklar listesi oluşturmak
ve yazara stratejik öneriler vermektir.

Kurallar:
- Yanıtı daima geçerli JSON formatında ver.
- Maildeki talepleri kaçırma.
- Editör talepleri ile reviewer taleplerini ayrı değerlendir.
- Major revision, minor revision, reject-resubmit, accept, format check gibi kararları ayırt et.
- Yapılması gerekenleri somut aksiyon maddelerine çevir.
- Klinik/akademik tonu koru.
- Gereksiz umut verme.
- Ret riskini gerçekçi değerlendir.
- Kullanıcıya doğrudan uygulanabilir öneriler ver.
- Cevap mektubu yazma; sadece analiz, to-do list ve öneri üret.
`;

export function reviewerAnalysisPrompt({ editorMail }) {
  return `
Aşağıda editör/reviewer maili var.

Mail içeriği:
"""
${editorMail}
"""

Bu maili analiz et ve aşağıdaki JSON şemasına göre yanıt ver.

Sadece JSON döndür:

{
  "decisionType": "accept | minor_revision | major_revision | reject_resubmit | reject | formatting_check | unknown",
  "overallRiskLevel": "low | moderate | high | very_high",
  "deadline": {
    "mentioned": true,
    "date": "",
    "daysGiven": null
  },
  "editorRequests": [
    {
      "request": "",
      "actionNeeded": "",
      "priority": "high | moderate | low",
      "difficulty": "easy | moderate | difficult",
      "notes": ""
    }
  ],
  "reviewerRequests": [
    {
      "reviewer": "Reviewer 1 | Reviewer 2 | Reviewer 3 | Unknown",
      "comment": "",
      "actionNeeded": "",
      "category": "methodology | statistics | language | novelty | ethics | formatting | figures_tables | references | clinical_interpretation | other",
      "priority": "high | moderate | low",
      "difficulty": "easy | moderate | difficult",
      "suggestedResponseStrategy": "",
      "whyImportant": "",
      "estimatedEffort": "small | medium | large",
      "requiresNewAnalysis": true,
      "requiresManuscriptChange": true,
      "requiresResponseLetter": true
    }
  ],
  "criticalIssues": [
    {
      "issue": "",
      "risk": "",
      "recommendedAction": ""
    }
  ],
  "quickWins": [
    {
      "task": "",
      "reason": ""
    }
  ],
  "recommendedWorkflow": [
    {
      "step": 1,
      "action": ""
    }
  ],
  "authorAdvice": "",
  "summaryForUser": ""
}
`;
}

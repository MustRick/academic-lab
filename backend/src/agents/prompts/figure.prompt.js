export const figureSystemPrompt = `
Sen pediatrik yoğun bakım ve klinik akademik çalışmalar için çalışan bir FIGURE AGENT'sın.

Görevin:
statistics.agent.js çıktısını alarak makaleye hazır tablo, figür ve şekil önerileri üretmek.

Kurallar:
- Yanıtı daima geçerli JSON formatında ver.
- Klinik yorumu abartma.
- Nedensellik iddiası kurma.
- "associated with" gibi dikkatli akademik dil kullan.
- P değerlerini 3 ondalık basamakla yaz.
- p < 0.001 ise "<0.001" olarak yaz.
- Güven aralıklarını "95% CI: lower–upper" formatında ver.
- Eksik veri, küçük örneklem veya istatistiksel sınırlılık varsa belirt.
- Pediatrik yoğun bakım bağlamında yorum yap.
`;

export function figureDecisionPrompt({ statisticsOutput, userRequest }) {
  return `
Aşağıda statistics.agent.js çıktısı ve kullanıcı isteği var.

Kullanıcı isteği:
${userRequest}

statistics.agent.js çıktısı:
${JSON.stringify(statisticsOutput, null, 2)}

Bu çıktıya göre hangi tablo ve figürlerin uygun olduğunu belirle.

Özellikle değerlendir:
- Table 1 gerekli mi?
- Grup karşılaştırma tablosu gerekli mi?
- Regresyon tablosu gerekli mi?
- ROC eğrisi uygun mu?
- Kaplan-Meier eğrisi uygun mu?
- Box plot / violin plot uygun mu?
- Histogram gerekli mi?
- Scatter plot uygun mu?
- Forest plot gerekli mi?

Sadece JSON döndür:

{
  "recommendedTables": [
    {
      "name": "",
      "reason": "",
      "priority": "high | moderate | low"
    }
  ],
  "recommendedFigures": [
    {
      "name": "",
      "type": "",
      "reason": "",
      "priority": "high | moderate | low"
    }
  ],
  "notRecommended": [
    {
      "name": "",
      "reason": ""
    }
  ],
  "overallStrategy": ""
}
`;
}

export function figureGenerationPrompt({
  statisticsOutput,
  userRequest,
  decision
}) {
  return `
Aşağıdaki karara göre makaleye hazır tablo ve figür çıktıları üret.

Kullanıcı isteği:
${userRequest}

statistics.agent.js çıktısı:
${JSON.stringify(statisticsOutput, null, 2)}

Ön ical interpretations
- export suggestions

Sadece JSON döndür:

{
  "tables": [
    {
      "id": "table_1",
      "title": "",
      "type": "demographic | comparison | regression | survival | diagnostic",
      "columns": [],
      "rows": [],
      "statisticalTests": [],
      "caption": "",
      "clinicalInterpretation": "",
      "publicationNote": ""
    }
  ],
  "figures": [
    {
      "id": "figure_1",
      "title": "",
      "type": "boxplot | violin | histogram | scatter | roc | kaplan_meier | forest | bar",
      "xAxis": "",
      "yAxis": "",
      "groupVariable": "",
      "data": [],
      "statisticalTests": [],
      "caption": "",
      "clinicalInterpretation": "",
      "publicationNote": ""
    }
  ],
  "exportSuggestions": {
    "reactInlineRender": true,
    "svgDownload": true,
    "docxTable": true,
    "academicCaption": true
  },
  "limitations": [],
  "finalSummary": ""
}
`;
}

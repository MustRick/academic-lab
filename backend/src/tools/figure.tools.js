export function createBoxPlot({ data, x, y, group }) {
    return {
      type: "boxplot",
      x,
      y,
      group,
      data,
      library: "plotly"
    };
  }
  
  export function createViolinPlot({ data, x, y, group }) {
    return {
      type: "violin",
      x,
      y,
      group,
      data,
      library: "plotly"
    };
  }
  
  export function createROC({ fpr, tpr, auc }) {
    return {
      type: "roc",
      xAxis: "1 - Specificity",
      yAxis: "Sensitivity",
      data: { fpr, tpr, auc },
      library: "recharts"
    };
  }
  
  export function createKaplanMeier({ groups }) {
    return {
      type: "kaplan_meier",
      xAxis: "Time",
      yAxis: "Survival probability",
      data: groups,
      library: "recharts"
    };
  }
  
  export function createTable({ title, columns, rows }) {
    return {
      type: "table",
      title,
      columns,
      rows
    };
  }
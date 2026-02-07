const USE_COLOR = process.stdout.isTTY;
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function style(text: string, ...styles: string[]) {
  if (!USE_COLOR) {
    return text;
  }
  return `${styles.join("")}${text}${COLORS.reset}`;
}

function label(text: string) {
  return style(text, COLORS.cyan);
}

function heading(text: string) {
  return style(text, COLORS.bold, COLORS.cyan);
}

function title(text: string) {
  return style(text, COLORS.bold, COLORS.yellow);
}

function stateColor(state: string) {
  switch (state) {
    case "DRAFT":
      return COLORS.gray;
    case "PLANNED":
      return COLORS.blue;
    case "AWAITING_APPROVAL":
      return COLORS.yellow;
    case "APPROVED":
      return COLORS.green;
    case "RUNNING":
      return COLORS.blue;
    case "PAUSED":
      return COLORS.yellow;
    case "FAILED":
      return COLORS.red;
    case "COMPLETED":
      return COLORS.green;
    case "REWOUND":
      return COLORS.magenta;
    case "RESUMED":
      return COLORS.cyan;
    default:
      return COLORS.gray;
  }
}

function formatState(state: string) {
  return style(state, stateColor(state), COLORS.bold);
}

export {
  USE_COLOR,
  COLORS,
  style,
  label,
  heading,
  title,
  stateColor,
  formatState,
};


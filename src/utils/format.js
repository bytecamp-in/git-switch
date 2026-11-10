import pc from 'picocolors';

export const colors = pc;

export function success(msg) {
  return `${pc.green('✔')} ${msg}`;
}

export function info(msg) {
  return `${pc.cyan('ℹ')} ${msg}`;
}

export function warning(msg) {
  return `${pc.yellow('⚠')} ${msg}`;
}

export function error(msg) {
  return `${pc.red('✖')} ${msg}`;
}

export function activeBadge(text = 'ACTIVE') {
  return pc.bgGreen(pc.black(` ${text} `));
}

export function dimBadge(text) {
  return pc.bgGray(pc.white(` ${text} `));
}

export function banner() {
  return `${pc.bold(pc.cyan('GitSwitch'))} ${pc.dim('v1.0.0')} - Fast GitHub Account Switcher\n`;
}


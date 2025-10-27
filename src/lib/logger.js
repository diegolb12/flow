const LEVELS = ['error','warn','info','debug'];
const current = process.env.LOG_LEVEL ?? 'info';
const idx = LEVELS.indexOf(current);
function log(level, ...args) {
const allow = LEVELS.indexOf(level) <= idx;
if (allow) console[level === 'debug' ? 'log' : level](`[${level.toUpperCase()}]`, ...args);
}
export const logger = {
error: (...a)=>log('error',...a),
warn: (...a)=>log('warn',...a),
info: (...a)=>log('info',...a),
debug: (...a)=>log('debug',...a)
};
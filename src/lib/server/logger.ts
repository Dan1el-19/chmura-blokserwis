const isDev = import.meta.env.DEV;

type LogFn = (...args: unknown[]) => void;

const debug: LogFn = (...args) => {
	if (isDev) {
		console.debug(...args);
	}
};

const info: LogFn = (...args) => {
	console.info(...args);
};

const warn: LogFn = (...args) => {
	console.warn(...args);
};

const error: LogFn = (...args) => {
	console.error(...args);
};

export const logger = {
	debug,
	info,
	warn,
	error
};

export type { LogFn };

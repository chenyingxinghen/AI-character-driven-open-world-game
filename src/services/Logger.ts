export class Logger {
  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }
  
  error(message: string, error?: Error, ...args: any[]) {
    console.error(`[ERROR] ${message}`, error, ...args);
  }
  
  debug(message: string, ...args: any[]) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }
}
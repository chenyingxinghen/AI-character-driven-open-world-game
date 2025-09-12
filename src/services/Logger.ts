export class Logger {
  info(message: string) {
    console.log(`[INFO] ${message}`);
  }
  
  error(message: string, error?: Error) {
    console.error(`[ERROR] ${message}`, error);
  }
  
  debug(message: string) {
    console.log(`[DEBUG] ${message}`);
  }
  
  warn(message: string) {
    console.warn(`[WARN] ${message}`);
  }
}
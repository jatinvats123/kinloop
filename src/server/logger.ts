// Structured JSON logger for Cloud Logging. Callers must never pass passcodes, emails or health details.

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";
type Fields = Record<string, string | number | boolean | null | undefined>;

function write(severity: Severity, message: string, fields: Fields = {}): void {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ severity, message, time: new Date().toISOString(), ...fields });
  (severity === "ERROR" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const logger = {
  info: (message: string, fields?: Fields) => write("INFO", message, fields),
  warn: (message: string, fields?: Fields) => write("WARNING", message, fields),
  error: (message: string, fields?: Fields) => write("ERROR", message, fields),
};

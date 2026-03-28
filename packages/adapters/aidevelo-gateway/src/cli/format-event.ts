import pc from "picocolors";

export function printAideveloGatewayStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  if (!debug) {
    console.log(line);
    return;
  }

  if (line.startsWith("[aidevelo-gateway:event]")) {
    console.log(pc.cyan(line));
    return;
  }

  if (line.startsWith("[aidevelo-gateway]")) {
    console.log(pc.blue(line));
    return;
  }

  console.log(pc.gray(line));
}

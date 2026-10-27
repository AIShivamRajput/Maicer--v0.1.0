// One long-lived PowerShell helper (fast, no per-paste startup cost): paste, copy, foreground app name.
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const SCRIPT = `Add-Type @"
using System; using System.Runtime.InteropServices; using System.Diagnostics;
public class W {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  public static long Hwnd() { return GetForegroundWindow().ToInt64(); }
  public static string App() { try { uint p; GetWindowThreadProcessId(GetForegroundWindow(), out p); return Process.GetProcessById((int)p).ProcessName; } catch { return ""; } }
}
"@
Add-Type -AssemblyName System.Windows.Forms
[Console]::Out.WriteLine("0 ready"); [Console]::Out.Flush()
while (($l = [Console]::In.ReadLine()) -ne $null) {
  $parts = $l.Split(' ', 2); $id = $parts[0]; $out = "ok"
  try {
    if ($parts[1] -eq "paste") { [System.Windows.Forms.SendKeys]::SendWait("^v") }
    elseif ($parts[1] -eq "copy") { [System.Windows.Forms.SendKeys]::SendWait("^c") }
    elseif ($parts[1] -eq "app") { $out = [W]::App() }
    elseif ($parts[1] -eq "hwnd") { $out = [W]::Hwnd().ToString() }
  } catch { $out = "error" }
  [Console]::Out.WriteLine("$id $out"); [Console]::Out.Flush()
}`;
let proc = null, seq = 0, buf = ''; const waiting = new Map();
function start() {
  const dir = path.join(process.env.LOCALAPPDATA || os.homedir(), 'Maicer'); fs.mkdirSync(dir, { recursive: true });   // per-user folder, not the shared temp folder
  const file = path.join(dir, 'helper.ps1'); fs.writeFileSync(file, SCRIPT);
  proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true });
  proc.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    const [id, ...rest] = line.split(' '); waiting.get(id)?.(rest.join(' ')); waiting.delete(id); } });
  proc.on('exit', () => { proc = null; for (const r of waiting.values()) r('error'); waiting.clear(); });
}
function send(cmd, timeout = 3000) {
  if (!proc) start();
  return new Promise(res => { const id = String(++seq); const t = setTimeout(() => { waiting.delete(id); res('timeout'); }, timeout);
    waiting.set(id, v => { clearTimeout(t); res(v); }); proc.stdin.write(`${id} ${cmd}\n`); });
}
module.exports = { init: start, paste: async () => (await send('paste')) === 'ok', copy: () => send('copy'),
  foregroundWindow: async () => { const v = await send('hwnd'); return v === 'timeout' || v === 'error' ? 0 : Number(v) || 0; },
  foregroundApp: async () => { const a = await send('app'); return a === 'timeout' || a === 'error' ? '' : a; }, stop: () => { try { proc?.kill(); } catch {} proc = null; } };

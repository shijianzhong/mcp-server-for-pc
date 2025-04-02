import { spawn } from 'child_process';

const proc = spawn('node', ['build/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });

proc.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

proc.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

// 模拟发送多行JSON请求
const input = `{"method":"tools/list","jsonrpc":"2.0","id":0}
{"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp-client-cli","version":"1.0.0"}},"jsonrpc":"2.0","id":1}`;

proc.stdin.write(input);

// 5秒后关闭进程
setTimeout(() => {
  proc.kill();
  console.log('测试完成');
}, 5000); 
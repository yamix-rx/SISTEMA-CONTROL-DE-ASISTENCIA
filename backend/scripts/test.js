const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function main() {
  const tempRoot = await fs.realpath(os.tmpdir());
  const temp = await fs.mkdtemp(path.join(tempRoot, 'sbss-tests-'));
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--test', ...process.argv.slice(2), 'tests/*.test.js'], {
        cwd: path.resolve(__dirname, '..'), env: { ...process.env, DOCUMENTOS_DIR: temp }, stdio: 'inherit', windowsHide: true
      });
      child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
    });
    process.exitCode = code;
  } finally {
    const target = await fs.realpath(temp);
    if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith('sbss-tests-')) throw new Error('Carpeta de pruebas inesperada; no se eliminó.');
    await fs.rm(target, { recursive: true, force: true });
  }
}
main().catch(error => { console.error('No se pudieron completar las pruebas:', error.code || error.name); process.exitCode = 1; });

$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $project 'node_modules/next/package.json'))) {
    throw 'Run npm ci in Patchwork before starting the local OAuth server.'
}

$node = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$openssl = (Get-Command openssl -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $openssl) {
    $git = (Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    if ($git) {
        $gitRoot = Split-Path -Parent (Split-Path -Parent $git)
        $openssl = Join-Path $gitRoot 'usr/bin/openssl.exe'
    }
}
if (-not $openssl -or -not (Test-Path -LiteralPath $openssl -PathType Leaf)) {
    throw 'OpenSSL is required. Use OpenSSL from Git for Windows or add it to PATH.'
}

$clientId = (Read-Host 'Buffer client ID').Trim()
if (-not $clientId) { throw 'Enter the client ID from Buffer App Clients.' }
$secret = Read-Host 'Buffer client secret' -AsSecureString

$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = $node
$start.Arguments = 'scripts/buffer-live.mjs'
$start.WorkingDirectory = $project
$start.UseShellExecute = $false
$start.EnvironmentVariables['BUFFER_CLIENT_ID'] = $clientId
$start.EnvironmentVariables['PATCHWORK_OPENSSL_PATH'] = $openssl

$pointer = [IntPtr]::Zero
try {
    if ($secret.Length -eq 0) { throw 'Enter the client secret from Buffer App Clients.' }
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $start.EnvironmentVariables['BUFFER_CLIENT_SECRET'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $child = [System.Diagnostics.Process]::Start($start)
} finally {
    $start.EnvironmentVariables.Remove('BUFFER_CLIENT_SECRET')
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $secret.Dispose()
}

try {
    $child.WaitForExit()
    if ($child.ExitCode -ne 0) { throw 'The local OAuth server stopped with an error.' }
} finally {
    if (-not $child.HasExited) { $child.Kill() }
    $child.Dispose()
}

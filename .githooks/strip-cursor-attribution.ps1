param([string]$MsgFile)
$content = Get-Content -Path $MsgFile -Raw
$patterns = @(
    '(?m)^Co-authored-by: Cursor <cursoragent@cursor\.com>\r?\n',
    '(?m)^Made-with: Cursor\r?\n'
)
foreach ($p in $patterns) {
    $content = $content -replace $p, ''
}
Set-Content -Path $MsgFile -Value $content.TrimEnd() -NoNewline

$msg = [Console]::In.ReadToEnd()
$msg = $msg -replace '(?m)^Co-authored-by: Cursor <cursoragent@cursor\.com>\r?\n', ''
$msg = $msg -replace '(?m)^Made-with: Cursor\r?\n', ''
Write-Output $msg.TrimEnd()

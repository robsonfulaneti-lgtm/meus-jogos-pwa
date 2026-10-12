$dir = Join-Path $PSScriptRoot 'covers'
$UA = 'GameTrackerBot/1.0 (contact: robson@formahomolog.com.br)'

function Steam($id){
  @(
    "https://cdn.cloudflare.steamstatic.com/steam/apps/$id/library_600x900.jpg",
    "https://cdn.cloudflare.steamstatic.com/steam/apps/$id/header.jpg"
  )
}
function Wiki($path){ ,@("https://upload.wikimedia.org/wikipedia/en/thumb/$path") }

$games = [ordered]@{
  're-dc'       = (Wiki 'a/a6/Resident_Evil_1_cover.png/250px-Resident_Evil_1_cover.png')
  're2c'        = (Wiki '4/40/NTSC_Resident_Evil_2_Cover.png/250px-NTSC_Resident_Evil_2_Cover.png')
  're2r'        = (Steam 883710)
  're3c'        = (Wiki 'a/a5/Resident_Evil_3_Cover.jpg/250px-Resident_Evil_3_Cover.jpg')
  're3r'        = (Steam 952060)
  'recvx'       = (Wiki '4/44/RECV_boxart.jpg/250px-RECV_boxart.jpg')
  're-veronica' = (Wiki '9/92/Resident_Evil_Veronica_cover_art.jpg/250px-Resident_Evil_Veronica_cover_art.jpg')
  're4c'        = (Steam 254700)
  're4r'        = (Steam 2050650)
  'rev2'        = (Steam 287290)
  'village'     = (Steam 1196590)
  'requiem'     = (Steam 3764200)
}

foreach($slug in $games.Keys){
  $ok = $false
  foreach($url in $games[$slug]){
    $ext = if($url -match '\.png'){ 'png' } else { 'jpg' }
    $out = Join-Path $dir "$slug.$ext"
    $code = curl.exe -s -L -A $UA -o $out -w "%{http_code}" $url
    $len  = (Get-Item $out -ErrorAction SilentlyContinue).Length
    if($code -eq '200' -and $len -gt 3000){
      Write-Host ("PASS  {0,-13} {1,7} bytes" -f $slug,$len); $ok=$true; break
    } else { Remove-Item $out -Force -ErrorAction SilentlyContinue }
  }
  if(-not $ok){ Write-Host ("FAIL  {0,-13}" -f $slug) }
}

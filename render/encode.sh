#!/usr/bin/env bash
# Encoding der Bildsequenz mit Tonmischung, Untertitelspur und eingebrannter Fassung.
set -euo pipefail
cd "$(dirname "$0")/.."
FR=30
SEQ=out/final/f%05d.jpg
mkdir -p output/audio
cp audio/out/stem_sprecher.wav audio/out/stem_musik.wav audio/out/stem_sfx.wav audio/out/mix.wav audio/out/mix_ohne_sprecher.wav output/audio/

# Hauptfassung: H.264 High, CRF 17, AAC 256 kbit/s, Untertitel als zuschaltbare Spur (mov_text)
ffmpeg -y -loglevel error -framerate $FR -i "$SEQ" -i audio/out/mix.wav -i output/ip3_Erklaervideo_DE.srt \
  -map 0:v -map 1:a -map 2:s \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -x264-params "keyint=60:min-keyint=30" -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 -c:s mov_text -metadata:s:s:0 language=ger -metadata:s:a:0 language=ger \
  -metadata title="ip³ Energietechnik GmbH · Wer regelt Ihren Solarpark?" -movflags +faststart \
  output/ip3_Erklaervideo_16x9.mp4

# Fassung mit eingebrannten Untertiteln (Markenschrift über fontconfig/fontsdir)
ffmpeg -y -loglevel error -framerate $FR -i "$SEQ" -i audio/out/mix.wav \
  -vf "subtitles=output/ip3_Erklaervideo_DE_einbrennen.ass:fontsdir=engine/assets/fonts" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart \
  output/ip3_Erklaervideo_16x9_UT.mp4

ls -la output/*.mp4

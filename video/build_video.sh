#!/usr/bin/env bash
# Build final ClimateProof demo: title cards + scenes + neural voiceover.
set -e
cd "C:\Users\REPUBLIC OF GAMERS\Desktop\Новая папка\climateproof\video"

ffmpeg -y -v error \
  -loop 1 -t 12 -i intro.png \
  -i scene1L.webm \
  -i scene2.webm \
  -i scene3.webm \
  -i scene4L.webm \
  -loop 1 -t 14 -i outro.png \
  -i seg1.mp3 -i seg2.mp3 -i seg3.mp3 -i seg4.mp3 -i seg5.mp3 -i seg6.mp3 -i seg7.mp3 \
  -filter_complex "\
[0:v]scale=1280:720,setsar=1,fps=30[v0];\
[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1];\
[2:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v2];\
[3:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v3];\
[4:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v4];\
[5:v]scale=1280:720,setsar=1,fps=30[v5];\
[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0[vout];\
[6:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=800|800[s1];\
[7:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=12600|12600[s2];\
[8:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=38000|38000[s3];\
[9:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=67000|67000[s4];\
[10:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=97200|97200[s5];\
[11:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=127500|127500[s6];\
[12:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=166400|166400[s7];\
anullsrc=r=44100:cl=stereo,atrim=duration=181[base];\
[base][s1][s2][s3][s4][s5][s6][s7]amix=inputs=8:duration=longest:normalize=0,atrim=duration=179.9[aout]" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 160k \
  -movflags +faststart \
  -t 179.9 \
  ClimateProof-demo.mp4

ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 ClimateProof-demo.mp4
echo "FINAL OK"

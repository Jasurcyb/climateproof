# Neural voiceover segments via edge-tts (Microsoft neural voices).
import subprocess, os

OUT = r"C:\Users\REPUBLIC OF GAMERS\Desktop\Новая папка\climateproof\video"
VOICE = "en-US-GuyNeural"

SEGS = [
    ("seg1.mp3", "ClimateProof. Climate data you can prove. A track four submission for the I-E-E-E Climate Chain Global Hackathon, twenty twenty-six."),
    ("seg2.mp3", "This is the Keeling curve. Eight hundred and twenty-three real monthly C-O-two measurements from N-O-A-A, going back to nineteen fifty-eight. The green line is our A-I model, trained seconds ago in this browser. Not in a cloud. On your device. Its forecast for twenty-fifty holds a backtest error of two-thirds of one part per million."),
    ("seg3.mp3", "Below, three monitoring stations stream live readings, and every single one is signed with a real E-C-D-S-A key. When a reading breaks physics by three sigma, the A-I flags it. Flagged, never deleted. The log keeps anomalies as evidence."),
    ("seg4.mp3", "The transparency ledger. Every block is S-H-A two-fifty-six hash-chained, and every reading sits in a Merkle tree. Press verify, and the browser recomputes every hash and checks every signature. Green. The whole chain checks out, right here, with zero trust in us."),
    ("seg5.mp3", "Now let's attack it. We rewrite a sealed reading, four twenty-six down to three fifty, making emissions look better. Immediately: block hash mismatch. The signature cannot be forged without the station's private key. The Merkle root stops recomputing. And every later block would break. The honest fix is a signed correction, appended to the log. History is corrected, never erased. Restore, and the chain verifies clean again."),
    ("seg6.mp3", "The A-I lab shows the full model. Seven parameters with physical meaning: the quadratic term is the human fingerprint, the sine pair is the planet breathing. Backtested on ten years it never saw: point six six P-P-M average error, R-squared ninety-nine point nine three. Training takes thirty milliseconds, on every visit."),
    ("seg7.mp3", "Climate Proof. Detection by A-I. Integrity by cryptography. Judgement by humans. For the data our climate decisions depend on. Thank you."),
]

for name, text in SEGS:
    path = os.path.join(OUT, name)
    subprocess.run(["edge-tts", "--voice", VOICE, "--text", text, "--write-media", path], check=True, capture_output=True)
    d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path], capture_output=True, text=True).stdout.strip()
    print(name, d + "s")
print("voiceover ok")

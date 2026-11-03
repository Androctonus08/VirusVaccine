# Local media analysis

VirusVaccine analyzes a file selected with the native picker. It does not capture calls, browser playback, microphones or cameras. There is no media upload. Optional setup downloads approximately 546 MB of pinned models and a decoder; allow additional extraction space. Model assets are not bundled in Git or the desktop executable.

## Models

| Component | Fixed artifact | Interpretation |
| --- | --- | --- |
| Visual | [Deep-Fake-Detector-v2-Model-ONNX](https://huggingface.co/onnx-community/Deep-Fake-Detector-v2-Model-ONNX/tree/4ea3d66dfb1bedca29727c6a0c6fa061d5f3f9c9), uint8 ONNX | Face-image classifier, output 0 realism / 1 deepfake; 224×224 RGB, NCHW, normalized to -1…1 |
| Audio | [deepfake-detector-onnx](https://huggingface.co/Red-had1911/deepfake-detector-onnx/tree/ae9cd3258b714a4afa4766c8c4de30bbde53dc0d), audio ONNX export | Export of [MelodyMachine/Deepfake-audio-detection-V2](https://huggingface.co/MelodyMachine/Deepfake-audio-detection-V2); output 0 fake / 1 real; 16 kHz mono, zero-mean/unit-variance waveform |
| Decoder | [BtbN FFmpeg LGPL shared build](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-11-02-12-51), n8.1.3-32-g760d10603e | Local audio/video decoding only; selected format and protocol allowlists |

Exact URLs, revisions, sizes and SHA-256 digests are in [media-assets.json](../src/main/media-assets.json). Models and decoder libraries are verified before analysis. Runtime versions are pinned through npm. See [third-party notices](../THIRD_PARTY_NOTICES.txt).

## Coverage and limitations

Files are limited to 512 MB. The decoder rejects unsupported formats, network playlists, excessive dimensions and durations exceeding one day. Analysis has a three-minute job limit. Video analysis requests at most eight frames, while audio examines at most four five-second segments. Results show requested frame positions and actual audio coverage. Seeking may return a nearby frame, particularly with sparse or variable frame rates. Missing frames are not counted. Silent/short audio segments remain unassessed.

The visual model analyzes face images, not motion, temporal consistency, lip-sync or all forms of generated imagery. There is no face detector or validated face-cropping pipeline in this version; whole frames are resized, which can reduce accuracy when faces are small or absent. Audio models are intended for speech; music, noise, codecs and unfamiliar generators may give unreliable outputs. No language-specific accuracy claims are made.

The app converts two logits to a softmax score, shows average/maximum scores and uses descriptive bands at 0.2 and 0.8. **These bands have not been calibrated against a representative dataset. They are not probabilities that a recording is fake.** An unflagged sample is not evidence that the full file is authentic. A flagged sample is not proof of manipulation or deception.

Verification uses a generated test pattern and tone to check actual decoding, tensor preparation, model execution, result plumbing and cancellation. Those fixtures do not measure classifier accuracy. Labeled real/synthetic speech and face datasets, generator holdouts, demographic/language coverage, compression robustness and false-positive calibration remain necessary before making effectiveness claims.

Media parsing and inference run in a separate process as the current Windows user. Cancellation terminates that owned process and its tracked decoder children. Process isolation prevents a native inference failure from taking down the app, but is not an OS security sandbox against a decoder exploit. Results remain in memory and are discarded on restart or a new analysis.

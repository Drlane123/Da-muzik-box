"""
Lightweight DDSP-inspired conditioned harmonic synthesizer.

Forward pass: f0 (Hz) + loudness (0–1) per frame → monophonic waveform.
Designed for ONNX export and CPU INT8 inference — not a full RAVE/DDSP clone,
but the same conditioning interface (f0 + amplitude → audio).
"""
from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F

from ai_song_pipeline.config import HOP_SIZE, N_HARMONICS, SAMPLE_RATE


class ConditionedHarmonicSynth(nn.Module):
    """
    Additive harmonic oscillator bank with learned harmonic weights.

    Inputs
      f0:       (batch, frames) fundamental frequency in Hz; 0 = silence
      loudness: (batch, frames) amplitude envelope 0–1

    Output
      audio: (batch, frames * hop_size) PCM in [-1, 1]
    """

    def __init__(
        self,
        hop_size: int = HOP_SIZE,
        sample_rate: int = SAMPLE_RATE,
        n_harmonics: int = N_HARMONICS,
    ) -> None:
        super().__init__()
        self.hop_size = hop_size
        self.sample_rate = sample_rate
        self.n_harmonics = n_harmonics

        # Learnable harmonic amplitudes (softmax-normalized in forward)
        self.harmonic_logits = nn.Parameter(torch.zeros(n_harmonics))
        self.noise_scale = nn.Parameter(torch.tensor(-2.0))

    def forward(self, f0: torch.Tensor, loudness: torch.Tensor) -> torch.Tensor:
        batch, n_frames = f0.shape
        device = f0.device

        # Upsample controls to sample rate
        f0_up = self._upsample(f0)  # (B, T)
        amp_up = self._upsample(loudness).clamp(0.0, 1.0)

        t = torch.arange(f0_up.shape[1], device=device, dtype=f0.dtype) / self.sample_rate
        t = t.unsqueeze(0).expand(batch, -1)

        harm_w = F.softmax(self.harmonic_logits, dim=0)
        audio = torch.zeros(batch, t.shape[1], device=device, dtype=f0.dtype)

        for h in range(1, self.n_harmonics + 1):
            phase = 2.0 * math.pi * h * torch.cumsum(f0_up / self.sample_rate, dim=1)
            audio = audio + harm_w[h - 1] * torch.sin(phase)

        # Unvoiced noise burst scaled by (1 - voiced_mask)
        voiced = (f0_up > 1.0).float()
        noise = torch.randn_like(audio) * torch.sigmoid(self.noise_scale)
        audio = audio * amp_up * voiced + noise * amp_up * (1.0 - voiced) * 0.72

        return torch.tanh(audio)

    def _upsample(self, x: torch.Tensor) -> torch.Tensor:
        """Repeat each frame hop_size times (matches ONNX-friendly ops)."""
        b, f = x.shape
        return x.unsqueeze(-1).repeat(1, 1, self.hop_size).reshape(b, f * self.hop_size)


def build_default_model() -> ConditionedHarmonicSynth:
    return ConditionedHarmonicSynth()

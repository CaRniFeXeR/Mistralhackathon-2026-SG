# 🦥 Taboo Game Guesser Fine-tuning (Unsloth + Mistral-Small 24B)

This folder contains the complete pipeline for fine-tuning the **Mistral-Small-3.2-24B-Instruct-2506** model to serve as a specialized Taboo word guesser.

**Hardware & venue**: Fine-tuning was run on an **ASUS Ascent GX10**, physically present and running locally at the hackathon venue in Singapore.

**Data source**: The game exposes an endpoint to **download game data** (logs, transcripts, guesses) so you can export sessions and feed them into this fine-tuning pipeline. 

## 🎯 Objective
The Guesser AI was prone to:
1.  **Parroting**: Repeating human guesses.
2.  **Self-Repetition**: Getting stuck in logic loops.
3.  **Hallucinating Headers**: Including `## Game Master` tags in its response.
4.  **Multi-word Struggles**: Failing on 3-4 word targets.

This SFT (Supervised Fine-Tuning) pipeline addresses these issues using high-quality curated data from the game logs.

---

## 📂 File Structure

| File | Purpose |
| :--- | :--- |
| `generate_sft_dataset_v4.py` | The main data cleaner. It sanitizes raw logs, reconstructs prompts from scratch, and removes all hallucinated headers. |
| `synthesize_validation.py` | Generates a high-quality 16-sample validation set for reliable evaluation. |
| `finetune_taboo_no_jinja.py` | The primary Unsloth training script. It manual formats prompts to avoid the `year > 2032` bug. |
| `merge_model.py` | Combines the LoRA adapters back into the base Mistral model for vLLM deployment. |
| `taboo_sft_dataset_final.jsonl` | The finalized training set (138 samples). |
| `taboo_sft_validation.jsonl` | The finalized validation set (16 samples). |

---

## 🛠️ Usage Instructions

### 1. Training (Unsloth)
Run the script inside an Unsloth-compatible environment (recommended: `unsloth/unsloth:dgxspark-latest` for ARM64/Blackwell):
```bash
python3 finetune_taboo_no_jinja.py
```
*Note: This script is memory-optimized for GB10 GPUs and forces a 4-bit quantization load to fit alongside the vLLM transcriber.*

### 2. Merging for Deployment
Once training hits 100/100, merge the adapters into a standard model:
```bash
python3 merge_model.py
```
The result will be saved in `../models/mistral-small-taboo-sft`.

### 3. Deploying (vLLM)
Use the dedicated launcher in the root directory:
```bash
cd ..
./run_guesser_sft.sh
```
This serves the guesser on port **8101** using **FP8 quantization** to ensure real-time performance on Blackwell.

---

## 🧱 Key Logic: Anti-Parroting
The training script utilizes a **Hardened History** strategy:
*   The `Your (LLM) guesses so far` and `Guesses of other players` sections in the prompt are strictly sanitized.
*   The SFT dataset is filtered so that the `assistant` output **never** matches any word found in the player history.
*   This trains the model to strictly look for *new* interpretations of the transcript.

---

## 📈 Performance Summary
*   **Base Model**: Mistral-Small-3.2-24B
*   **Epochs**: 2.87
*   **Final Training Loss**: ~0.12
*   **Final Validation Loss**: ~0.49
*   **Format**: 1-4 word pure responses (no quotes, no preamble).

---

![Pixel cat animation](../frontend/public/pixel-cat-animated.svg)

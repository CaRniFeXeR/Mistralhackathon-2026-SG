from unsloth import FastLanguageModel
import torch

MODEL_NAME = "mistralai/Mistral-Small-3.2-24B-Instruct-2506"
ADAPTER_PATH = "/home/mistralhackathon/git/Mistralhackathon-2026-SG-VLLM/finetuning/taboo-mistral-small-finetuned_adapters"
SAVE_PATH = "/home/mistralhackathon/git/Mistralhackathon-2026-SG-VLLM/finetuning/taboo-mistral-small-finetuned-merged"

def merge():
    print(f"Loading base model {MODEL_NAME} and adapters {ADAPTER_PATH}...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = MODEL_NAME,
        max_seq_length = 4096,
        load_in_4bit = True,
        dtype = torch.bfloat16,
        device_map = {"": 0},
    )
    
    # Load the adapters we just trained
    model.load_adapter(ADAPTER_PATH)
    
    print(f"Merging and saving model to {SAVE_PATH}...")
    # save_pretrained_merged combines LoRA and Base into a single model
    # We save in 16-bit so vLLM can handle the quantization to FP8 on load
    model.save_pretrained_merged(SAVE_PATH, tokenizer, save_method = "merged_16bit")
    print("Merge complete!")

if __name__ == "__main__":
    merge()

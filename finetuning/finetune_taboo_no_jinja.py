import os
import torch
from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# CONFIGURATIONS
MODEL_NAME = "mistralai/Mistral-Small-3.2-24B-Instruct-2506"
TRAIN_FILE = "game_dataset/taboo_sft_dataset_final.jsonl"
VALID_FILE = "game_dataset/taboo_sft_validation.jsonl"
OUTPUT_DIR = "taboo-mistral-small-finetuned"

def main():
    # 1. Load Model with forced GPU placement
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=4096,
        load_in_4bit=True,
        dtype=torch.bfloat16,
        device_map={"": 0}, 
    )

    # 2. Add LoRA Adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=32,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
        fix_mistral_regex=True, # Recommended by Unsloth for Mistral 3.2
    )

    # 3. Manual Formatting Function (Bypasses Jinja bugs)
    # Mistral format: <s>[INST] {system}\n\n{user} [/INST] {assistant} </s>
    def manual_mistral_format(examples):
        texts = []
        for messages in examples["messages"]:
            system = ""
            user = ""
            assistant = ""
            for msg in messages:
                if msg["role"] == "system":
                    system = msg["content"]
                elif msg["role"] == "user":
                    user = msg["content"]
                elif msg["role"] == "assistant":
                    assistant = msg["content"]
            
            # Construct the exact Mistral-Small prompt
            prompt = f"<s>[INST] {system}\n\n{user} [/INST] {assistant} </s>"
            texts.append(prompt)
        return { "text" : texts }

    dataset = load_dataset("json", data_files={"train": TRAIN_FILE, "test": VALID_FILE})
    dataset = dataset.map(manual_mistral_format, batched=True)

    # 4. Initialize SFTTrainer
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        dataset_text_field="text",
        max_seq_length=4096,
        dataset_num_proc=4,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=1, # Conservative for VRAM
            gradient_accumulation_steps=4,
            warmup_steps=5,
            max_steps=100,
            learning_rate=2e-4,
            bf16=True,
            logging_steps=1,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            output_dir=OUTPUT_DIR,
            eval_strategy="steps", # Updated for Transformers v5
            eval_steps=20,
            save_strategy="steps",
            save_steps=20,
            report_to=[],
        ),
    )


    print("Starting manual-formatted SFT via Unsloth...")
    trainer.train()

    model.save_pretrained(f"{OUTPUT_DIR}_adapters")
    tokenizer.save_pretrained(f"{OUTPUT_DIR}_adapters")
    print(f"Success! Adapters saved to {OUTPUT_DIR}_adapters")

if __name__ == "__main__":
    main()

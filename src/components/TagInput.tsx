import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}

export default function TagInput({ tags, onChange, placeholder = "Type and press Enter...", suggestions, className }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags.length - 1);
    }
  };

  const unusedSuggestions = suggestions?.filter((s) => !tags.includes(s));

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-background min-h-[38px] items-center">
        {tags.map((tag, i) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-[11px] pl-2 pr-1 py-0.5">
            {tag}
            <button onClick={() => removeTag(i)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : "Add more..."}
          className="border-0 shadow-none p-0 h-6 text-sm flex-1 min-w-[120px] focus-visible:ring-0"
        />
      </div>
      {unusedSuggestions && unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

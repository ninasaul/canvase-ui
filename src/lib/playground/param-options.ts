import type { OptionRadioItem } from "@/components/ui/option-radio-group";
import { messages } from "@/messages";

export function toRadioOptions(values: readonly string[]): OptionRadioItem[] {
  return values.map((value) => ({ value, label: value }));
}

export function playgroundFamilyLabel(family: string): string {
  const labels = messages.playground.familyLabels;
  return labels[family as keyof typeof labels] ?? family;
}

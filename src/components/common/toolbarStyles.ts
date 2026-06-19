export const toolbarFieldClass = [
  "h-11 min-w-0 rounded-lg border border-border-hairline bg-background/80 px-3",
  "text-sm text-foreground shadow-soft outline-none",
  "transition-[border-color,background-color,box-shadow]",
  "placeholder:text-muted-foreground/60 hover:bg-background",
  "focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/15",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
].join(" ");

export const toolbarSelectClass = `${toolbarFieldClass} appearance-auto pr-9`;

export const toolbarPrimaryButtonClass =
  "btn btn-primary h-11 min-h-11 rounded-lg px-5 text-sm shadow-soft active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

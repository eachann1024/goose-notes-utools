import * as React from "react";
import { Dropdown, Popover as HeroPopover } from "@heroui/react";
import { cn } from "@/lib/utils";
import { TriggerChild } from "./trigger-child";

function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  modal: _modal,
  children,
}: React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
}>) {
  return (
    <Dropdown
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </Dropdown>
  );
}
const DropdownMenuTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => (
  <HeroPopover.Trigger
    {...props}
    ref={ref as React.Ref<HTMLDivElement>}
    render={
      asChild && React.isValidElement(children)
        ? (injected) => (
            <TriggerChild
              child={
                children as React.ReactElement<
                  React.HTMLAttributes<HTMLElement>
                >
              }
              injected={injected}
            />
          )
        : undefined
    }
  >
    {asChild ? undefined : children}
  </HeroPopover.Trigger>
));
type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  editorContext?: boolean;
  forceMount?: boolean;
  onCloseAutoFocus?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
  onPointerDownOutside?: (event: Event) => void;
};
const DropdownMenuContent = React.forwardRef<HTMLElement, ContentProps>(
  (
    {
      children,
      className,
      align = "start",
      side = "bottom",
      sideOffset = 6,
      alignOffset = 0,
      collisionPadding = 8,
      editorContext,
      forceMount: _forceMount,
      onCloseAutoFocus: _onCloseAutoFocus,
      onInteractOutside: _onInteractOutside,
      onPointerDownOutside: _onPointerDownOutside,
      ...props
    },
    ref,
  ) => (
    <Dropdown.Popover
      {...props}
      ref={ref}
      offset={sideOffset}
      crossOffset={alignOffset}
      containerPadding={collisionPadding}
      placement={
        align === "center"
          ? side
          : side === "top" || side === "bottom"
            ? `${side} ${align}`
            : `${side} ${align === "start" ? "top" : "bottom"}`
      }
      data-goose-floating-content=""
      className={cn(
        "z-[20000] min-w-[9.5rem] max-h-[var(--available-height)] overflow-y-auto rounded-[14px] border-0 bg-[hsl(var(--popover))] p-1.5 text-popover-foreground outline-none",
        !editorContext && className,
      )}
      style={{
        boxShadow:
          "0 14px 34px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.08)",
        ...props.style,
      }}
    >
      <Dropdown.Menu
        aria-label="操作"
        className={cn(
          "outline-none",
          editorContext && "goose-editor-context-ui",
          editorContext && className,
        )}
      >
        {children}
      </Dropdown.Menu>
    </Dropdown.Popover>
  ),
);
const itemClass =
  "relative flex cursor-default select-none items-center gap-2 rounded-[10px] pe-2 ps-2 py-1.5 text-[13px] outline-none transition-colors hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] focus:bg-[var(--goose-interactive-selected)] focus:text-[var(--goose-interactive-selected-fg)] data-[hovered]:bg-[var(--goose-interactive-selected)] data-[hovered]:text-[var(--goose-interactive-selected-fg)] data-[focused]:bg-[var(--goose-interactive-selected)] data-[focused]:text-[var(--goose-interactive-selected-fg)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
type ItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof Dropdown.Item>,
  "onSelect" | "children" | "onClick"
> & {
  children?: React.ReactNode;
  inset?: boolean;
  disabled?: boolean;
  onSelect?: (event: Event) => void;
  onClick?: () => void;
};
const DropdownMenuItem = React.forwardRef<HTMLDivElement, ItemProps>(
  (
    { className, inset, disabled, onSelect, onClick, children, ...props },
    ref,
  ) => (
    <Dropdown.Item
      {...props}
      ref={ref}
      isDisabled={disabled}
      className={cn(itemClass, inset && "pl-8", className)}
      onAction={() => {
        const event = new Event("select", { cancelable: true });
        onSelect?.(event);
        if (!event.defaultPrevented) onClick?.();
      }}
    >
      {children}
    </Dropdown.Item>
  ),
);
function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
}: React.PropsWithChildren<{
  value: string;
  onValueChange?: (value: string) => void;
}>) {
  return (
    <Dropdown.Section
      selectionMode="single"
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        if (keys !== "all") {
          const key = keys.values().next().value;
          if (key !== undefined) onValueChange?.(String(key));
        }
      }}
    >
      {children}
    </Dropdown.Section>
  );
}
function DropdownMenuRadioItem({
  value,
  children,
  className,
  ...props
}: Omit<ItemProps, "value"> & { value: string }) {
  return (
    <DropdownMenuItem {...props} id={value} className={cn("ps-8", className)}>
      <Dropdown.ItemIndicator />
      {children}
    </DropdownMenuItem>
  );
}
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";
DropdownMenuContent.displayName = "DropdownMenuContent";
DropdownMenuItem.displayName = "DropdownMenuItem";
function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function DropdownMenuPortal({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

function DropdownMenuSub({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(itemClass, className)} {...props}>
      {children}
    </div>
  );
}

function DropdownMenuSubContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ms-1 border-l border-border ps-1", className)} {...props}>
      {children}
    </div>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  onClick,
  ...props
}: ItemProps & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <DropdownMenuItem
      className={className}
      {...props}
      onClick={onClick ?? (() => onCheckedChange?.(!checked))}
    >
      {children}
    </DropdownMenuItem>
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ms-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
};

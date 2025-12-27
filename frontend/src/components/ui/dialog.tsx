import { Dialog as ChakraDialog, Portal, Text, Button } from "@chakra-ui/react";
import { forwardRef } from "react";

export const DialogContent = forwardRef<
  HTMLDivElement,
  ChakraDialog.ContentProps
>(function DialogContent(props, ref) {
  const { children, ...rest } = props;
  return (
    <Portal>
      <ChakraDialog.Positioner>
        <ChakraDialog.Content ref={ref} {...rest}>
          {children}
        </ChakraDialog.Content>
      </ChakraDialog.Positioner>
    </Portal>
  );
});

export const DialogCloseTrigger = forwardRef<
  HTMLButtonElement,
  ChakraDialog.CloseTriggerProps
>(function DialogCloseTrigger(props, ref) {
  return (
    <ChakraDialog.CloseTrigger
      position="absolute"
      top="2"
      right="2"
      {...props}
      ref={ref}
    />
  );
});

export const DialogBackdrop = forwardRef<
  HTMLDivElement,
  ChakraDialog.BackdropProps
>(function DialogBackdrop(props, ref) {
  return (
    <Portal>
      <ChakraDialog.Backdrop
        ref={ref}
        bg="blackAlpha.700"
        {...props}
      />
    </Portal>
  );
});

export const DialogRoot = ChakraDialog.Root;
export const DialogHeader = ChakraDialog.Header;
export const DialogTitle = ChakraDialog.Title;
export const DialogBody = ChakraDialog.Body;
export const DialogFooter = ChakraDialog.Footer;
export const DialogTrigger = ChakraDialog.Trigger;

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  confirmVariant?: "solid" | "outline" | "ghost";
  confirmColorScheme?: "red" | "blue" | "gray";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  confirmVariant = "solid",
  confirmColorScheme = "red",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center">
      <DialogBackdrop />
      <DialogContent bg="bg.panel" maxW="sm" borderWidth="1px" borderColor="border.DEFAULT">
        <DialogHeader>
          <DialogTitle color="fg.DEFAULT">{title}</DialogTitle>
        </DialogHeader>
        {description && (
          <DialogBody>
            <Text color="fg.muted">{description}</Text>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            colorScheme={confirmColorScheme}
            variant={confirmVariant}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}


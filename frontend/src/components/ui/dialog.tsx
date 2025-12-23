import { Dialog as ChakraDialog, Portal } from "@chakra-ui/react";
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


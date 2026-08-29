import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedModal } from "@/components/ui/animated-modal";

interface GuideModalProps {
  title: string;
  children: React.ReactNode;
}

export function GuideModal({ title, children }: GuideModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 bg-background/50 hover:bg-background/80"
        onClick={() => setIsOpen(true)}
      >
        <BookOpen className="size-3.5" />
        <span>Guide</span>
      </Button>

      <AnimatedModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        icon={<BookOpen className="size-5" />}
      >
        <div className="space-y-4 text-sm text-muted-foreground p-1">
          {children}
        </div>
      </AnimatedModal>
    </>
  );
}

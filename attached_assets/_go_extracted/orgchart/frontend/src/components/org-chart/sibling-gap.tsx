import { motion } from "framer-motion";

interface SiblingGapProps {
  parentId: number | null;
  index: number;
  active: boolean;
  canAccept: boolean;
  onDragOver: (parentId: number | null, index: number) => void;
  onDragLeave: () => void;
  onDrop: (parentId: number | null, index: number) => void;
}

export function SiblingGap({
  parentId,
  index,
  active,
  canAccept,
  onDragOver,
  onDragLeave,
  onDrop,
}: SiblingGapProps) {
  return (
    <div
      data-testid={`sibling-gap-${parentId ?? "root"}-${index}`}
      className="self-stretch flex items-center justify-center relative pointer-events-auto"
      style={{ width: 32 }}
      onDragOver={(e) => {
        if (!canAccept) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        onDragOver(parentId, index);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onDragLeave();
      }}
      onDrop={(e) => {
        if (!canAccept) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(parentId, index);
      }}
    >
      {active && (
        <motion.div
          layout
          initial={{ opacity: 0, scaleY: 0.6 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-y-2 w-1 rounded-full bg-primary shadow-md ring-2 ring-primary/20"
          data-testid="reorder-indicator"
        />
      )}
    </div>
  );
}

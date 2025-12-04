import { useState, useCallback } from "react";

interface FileSelectionState {
  multiSelectMode: boolean;
  selectedKeys: string[];
  setMultiSelectMode: (mode: boolean) => void;
  toggleMultiSelectMode: () => void;
  toggleSelect: (key: string) => void;
  selectKeys: (keys: string[]) => void;
  clearSelection: () => void;
  isSelected: (key: string) => boolean;
}

export function useFileSelection(): FileSelectionState {
  const [multiSelectMode, setMultiSelectModeState] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const setMultiSelectMode = useCallback((mode: boolean) => {
    setMultiSelectModeState(mode);
    if (!mode) {
      setSelectedKeys([]);
    }
  }, []);

  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectModeState((prev) => {
      if (prev) {
        setSelectedKeys([]);
      }
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const selectKeys = useCallback((keys: string[]) => {
    setSelectedKeys(keys);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const isSelected = useCallback(
    (key: string) => selectedKeys.includes(key),
    [selectedKeys]
  );

  return {
    multiSelectMode,
    selectedKeys,
    setMultiSelectMode,
    toggleMultiSelectMode,
    toggleSelect,
    selectKeys,
    clearSelection,
    isSelected,
  };
}

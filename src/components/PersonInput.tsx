// src/components/PersonInput.tsx — 人员输入自动补全（匹配本名+花名）

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTaskStore, Person } from '../store/useTaskStore';

interface PersonInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export default function PersonInput({ value, onChange, placeholder, label }: PersonInputProps) {
  const { people } = useTaskStore();
  const [focused, setFocused] = useState(false);
  const [search, setSearch] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 外部 value 变化时同步 search
  useEffect(() => {
    setSearch(value);
  }, [value]);

  const suggestions = useMemo(() => {
    if (!search.trim() || !focused) return [];
    const q = search.toLowerCase();
    return people
      .filter(p => p.name.toLowerCase().includes(q) || (p.nickname && p.nickname.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [people, search, focused]);

  const handleSelect = (person: Person) => {
    const label = person.nickname ? `${person.name}（${person.nickname}）` : person.name;
    setSearch(label);
    onChange(person.name);
    setFocused(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focused || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setFocused(false);
      setSelectedIndex(-1);
    }
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          listRef.current && !listRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative">
      {label && <label className="text-xs text-zinc-500 dark:text-zinc-400">{label}</label>}
      <input
        ref={inputRef}
        type="text"
        value={search}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setSelectedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className="w-full mt-1 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />

      {focused && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
        >
          {suggestions.map((person, idx) => {
            const label = person.nickname ? `${person.name}（${person.nickname}）` : person.name;
            const q = search.toLowerCase();
            const matchField = person.name.toLowerCase().includes(q) ? 'name' : 'nickname';
            return (
              <button
                key={person.id}
                onClick={() => handleSelect(person)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === suggestions.length - 1 ? 'rounded-b-lg' : ''}`}
              >
                <span>👤</span>
                <span className="flex-1">{label}</span>
                {matchField === 'nickname' && person.name && (
                  <span className="text-xs text-zinc-400">本名: {person.name}</span>
                )}
                {person.email && (
                  <span className="text-xs text-zinc-400">{person.email}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

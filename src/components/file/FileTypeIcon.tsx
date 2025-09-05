import React from 'react';
import { clsx } from 'clsx';
import { FileArchive, FileAudio2, FileVideo2, FileCode2, FileText, FileImage, File as FileGeneric } from 'lucide-react';

// Map popular extensions to a semantic category
const extensionCategoryMap: Record<string, string> = {
  // archives
  'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'gz': 'archive', 'tar': 'archive',
  // documents / office
  'pdf': 'pdf', 'doc': 'doc', 'docx': 'doc', 'xls': 'xls', 'xlsx': 'xls', 'ppt': 'ppt', 'pptx': 'ppt',
  'txt': 'text', 'md': 'text', 'rtf': 'text',
  // code
  'js': 'code', 'ts': 'code', 'json': 'code', 'xml': 'code', 'html': 'code', 'css': 'code', 'tsx': 'code', 'jsx': 'code', 'sh': 'code',
  // media
  'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image', 'bmp': 'image',
  'mp4': 'video', 'webm': 'video', 'mov': 'video', 'mkv': 'video', 'ogg': 'video',
  'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'm4a': 'audio', 'aac': 'audio', 'opus': 'audio'
};

interface FileTypeIconProps {
  fileName?: string;
  extension?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeStyles: Record<string, string> = {
  sm: 'h-10 w-10 text-xs',
  md: 'h-14 w-14 text-sm',
  lg: 'h-20 w-20 text-base'
};

// Background color accents per category
const categoryStyles: Record<string, string> = {
  archive: 'bg-amber-100 text-amber-700 border-amber-300',
  pdf: 'bg-red-100 text-red-700 border-red-300',
  doc: 'bg-blue-100 text-blue-700 border-blue-300',
  xls: 'bg-green-100 text-green-700 border-green-300',
  ppt: 'bg-orange-100 text-orange-700 border-orange-300',
  text: 'bg-gray-100 text-gray-700 border-gray-300',
  code: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  image: 'bg-pink-100 text-pink-700 border-pink-300',
  video: 'bg-purple-100 text-purple-700 border-purple-300',
  audio: 'bg-teal-100 text-teal-700 border-teal-300',
  default: 'bg-slate-100 text-slate-600 border-slate-300'
};

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({ fileName, extension, className, size = 'md', showLabel = true }) => {
  const ext = (extension || fileName?.split('.').pop() || '').toLowerCase();
  const category = extensionCategoryMap[ext] || 'default';
  const containerClasses = clsx('flex flex-col items-center justify-center rounded-xl border font-semibold select-none', sizeStyles[size], categoryStyles[category], className, 'p-1 gap-0.5');

  const label = ext || 'FILE';

  const iconProps = { className: 'h-1/2 w-1/2 opacity-70' };
  let IconEl: React.ReactNode;
  switch (category) {
    case 'archive': IconEl = <FileArchive {...iconProps} />; break;
    case 'audio': IconEl = <FileAudio2 {...iconProps} />; break;
    case 'video': IconEl = <FileVideo2 {...iconProps} />; break;
    case 'code': IconEl = <FileCode2 {...iconProps} />; break;
    case 'image': IconEl = <FileImage {...iconProps} />; break;
    case 'pdf': IconEl = <FileText {...iconProps} />; break;
    case 'text': IconEl = <FileText {...iconProps} />; break;
    default: IconEl = <FileGeneric {...iconProps} />; break;
  }

  return (
    <div className={containerClasses} aria-label={`Typ pliku ${label}`} title={label}>
      {IconEl}
      {showLabel && <span className="uppercase tracking-tight leading-none mt-0.5 text-[0.6rem] md:text-[0.65rem]">{label}</span>}
    </div>
  );
};

export default FileTypeIcon;
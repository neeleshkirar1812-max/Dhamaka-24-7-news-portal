"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Video as YoutubeIcon,
} from "lucide-react";
import { AiToolbar } from "./AiToolbar";

export function TiptapEditor({
  value,
  onChange,
  aiAvailable,
  aiDisabledReason,
  onAiUsed,
}: {
  value: string;
  onChange: (html: string) => void;
  aiAvailable: boolean;
  aiDisabledReason?: string;
  onAiUsed?: () => void;
}) {
  const [selectedText, setSelectedText] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Youtube.configure({ width: 640, height: 360 }),
      Placeholder.configure({
        placeholder: "यहाँ समाचार लिखें (Write your news story here)...",
      }),
    ],
    content: value,
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
    },
    onSelectionUpdate({ editor: ed }) {
      const { from, to } = ed.state.selection;
      const text = ed.state.doc.textBetween(from, to, "\n");
      setSelectedText(text);
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  function addLink() {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function addImage() {
    const url = window.prompt("Enter Image URL:");
    if (!url) return;
    editor?.chain().focus().setImage({ src: url }).run();
  }

  function addYoutube() {
    const url = window.prompt("Enter YouTube Video URL:");
    if (!url) return;
    editor?.commands.setYoutubeVideo({ src: url });
  }

  const btnCls = (active: boolean) =>
    `p-1.5 rounded text-slate-700 hover:bg-slate-200 transition cursor-pointer ${
      active ? "bg-slate-200 text-red-700 font-semibold" : ""
    }`;

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnCls(editor.isActive("bold"))}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnCls(editor.isActive("italic"))}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnCls(editor.isActive("heading", { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnCls(editor.isActive("heading", { level: 3 }))}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnCls(editor.isActive("bulletList"))}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnCls(editor.isActive("orderedList"))}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btnCls(editor.isActive("blockquote"))}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button type="button" onClick={addLink} className={btnCls(editor.isActive("link"))} title="Link">
          <Link2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={addImage} className={btnCls(false)} title="Insert Image URL">
          <ImageIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={addYoutube} className={btnCls(false)} title="Embed YouTube">
          <YoutubeIcon className="w-4 h-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className={btnCls(false)}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className={btnCls(false)}
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      <AiToolbar
        selectedText={selectedText}
        aiAvailable={aiAvailable}
        aiDisabledReason={aiDisabledReason}
        onAccept={(newText) => {
          editor.chain().focus().insertContent(newText).run();
          onAiUsed?.();
        }}
      />

      <EditorContent
        editor={editor}
        className="prose max-w-none p-4 min-h-[320px] focus:outline-none article-prose [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[290px]"
      />
    </div>
  );
}

import { useState } from "react";

interface SentenceInputProps {
  onSubmit: (text: string) => Promise<void>;
  isProcessing: boolean;
}

export const SentenceInput = ({
  onSubmit,
  isProcessing,
}: SentenceInputProps) => {
  const [text, setText] = useState("");

  const handleSubmit = async () => {
    if (!text.trim() || isProcessing) return;

    await onSubmit(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl mb-6">
      <div className="card-body">
        <h2 className="card-title text-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          輸入英文文字
        </h2>
        <p className="text-sm text-base-content/60 mb-2">
          貼上英文段落或句子，系統會自動分句並翻譯成中文
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="在這裡貼上或輸入英文文字..."
          className="textarea textarea-bordered w-full h-32 text-base"
          disabled={isProcessing}
        />
        <div className="card-actions justify-between items-center mt-2">
          <span className="text-xs text-base-content/50">
            按 Ctrl + Enter 快速提交
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || isProcessing}
            className="btn btn-primary"
          >
            {isProcessing ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                處理中...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                分句並翻譯
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

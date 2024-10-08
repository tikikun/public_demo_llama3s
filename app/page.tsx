'use client';
import { useState, useRef } from 'react';
import { useChat } from 'ai/react';
import WavEncoder from 'wav-encoder';

export default function Chat() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const {
    error,
    input,
    isLoading,
    handleInputChange,
    handleSubmit,
    messages,
    reload,
    stop,
    setInput,
  } = useChat({
    keepLastMessageOnError: true,
    onFinish(message, { usage, finishReason }) {
      console.log('Usage', usage);
      console.log('FinishReason', finishReason);
      console.log('Debug messages:  ', messages);
    },
  });

  const submitForm = async (formData: any) => {
    try {
      const response = await fetch('/api/tokenize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to tokenize audio');
      }

      const data = await response.json();
      handleSubmit(data.tokens);
    } catch (error) {
      console.error('Error tokenizing audio:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext)();
        const audioData = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = [];
        for (let i = 0; i < audioData.numberOfChannels; i++) {
          channelData.push(audioData.getChannelData(i));
        }

        const wavData = await WavEncoder.encode({
          sampleRate: audioData.sampleRate,
          channelData: channelData,
        });

        const wavBlob = new Blob([new Uint8Array(wavData)], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(wavBlob);
        //setAudioURL(audioUrl);

        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');

        try {
          const response = await fetch('/api/tokenize', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to tokenize audio');
          }

          const data = await response.json();
          setInput(`<|sound_start|>${data.tokens}`);
        } catch (error) {
          console.error('Error tokenizing audio:', error);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFormSubmit = (e: any) => {
    e.preventDefault();
    handleSubmit(e);
    setAudioURL(null);
  };

  const displayInput = input.includes('<|sound_start|>')
    ? '🔊 🔊 Audio 🔊 🔊 '
    : input;

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <div className="mb-4 p-4 bg-gray-100 rounded-lg shadow-md">
        <h1 className="text-xl font-bold">Ichigo: checkpoint Aug 24, 2024</h1>
        <p className="mt-2">This model is capable of multi-modality, you can input either text, or voice through recording button!</p>
        <p className="mt-2">Powered by <a href="https://homebrew.ltd/" target="_blank" className="text-blue-500 hover:underline">Homebrew Ltd</a> | <a href="https://homebrew.ltd/blog/llama3-just-got-ears" target="_blank" className="text-blue-500 hover:underline">Read our blog post</a></p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map(m => {
          const displayContent = m.role === 'user'
            ? (m.content.startsWith('<|sound_start|>')
              ? <i>🔊 This is an audio message 🔊</i>
              : m.content.split(' ').slice(0, 10).join(' '))
            : m.content;
          return (
            <div key={m.id} className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'} max-w-[80%]`}>
              <p className="font-semibold mb-1">{m.role === 'user' ? 'You:' : 'Ichigo:'}</p>
              <p className="whitespace-pre-wrap text-sm">{displayContent}</p>
            </div>
          );
        })}
      </div>
      {isLoading && (
        <div className="mt-4 text-gray-500">
          <div className="animate-pulse">AI is thinking...</div>
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md hover:bg-blue-100 transition-colors"
            onClick={stop}
          >
            Stop
          </button>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <div className="text-red-500 bg-red-100 p-3 rounded-md">An error occurred.</div>
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md hover:bg-blue-100 transition-colors"
            onClick={() => reload()}
          >
            Retry
          </button>
        </div>
      )}
      <form onSubmit={handleFormSubmit} className="mt-4">
        <input
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={displayInput}
          placeholder="Say something..."
          onChange={(e) => {
            handleInputChange(e);
            if (e.target.value.includes('<|sound_start|>')) {
              setInput('This is an audio message');
            }
          }}
          disabled={isLoading || error != null}
        />
        <div className="flex justify-between mt-2">
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !audioURL)}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`ml-2 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors ${isRecording
              ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500'
              : 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500'
              }`}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
      </form>
      {audioURL && (
        <div className="mt-4">
          <audio src={audioURL} controls className="w-full" />
        </div>
      )}
    </div>
  );
}

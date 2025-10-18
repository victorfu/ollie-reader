import PdfReader from "./components/PdfReader";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="mt-10">
          <PdfReader />
        </div>
      </div>
    </div>
  );
}

export default App;

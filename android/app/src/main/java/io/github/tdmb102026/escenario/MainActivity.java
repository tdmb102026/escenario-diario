package io.github.tdmb102026.escenario;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

// Abre la app web Escenario Diario por dentro y le da lo que el WebView no tiene:
// la voz de Android que lee los discursos y el reconocimiento de voz de Google sin ventanita,
// que sigue escuchando aunque hagas pausas hasta que tocas Detener.
public class MainActivity extends Activity {
    static final String URL = "https://tdmb102026.github.io/escenario-diario/";
    private static final int PEDIR_MIC = 1;

    private WebView web;
    private final Handler h = new Handler(Looper.getMainLooper());

    // Voz que lee
    private TextToSpeech tts;
    private boolean ttsListo = false;

    // Oído (dictado continuo)
    private SpeechRecognizer oido;
    private boolean escuchando = false;
    private boolean micPendiente = false;
    private int erroresSeguidos = 0;
    private boolean silenciado = false;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        web.addJavascriptInterface(new Puente(), "AndroidVoz");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
                Uri u = pedido.getUrl();
                if ("tdmb102026.github.io".equals(u.getHost()) && u.getPath() != null
                        && u.getPath().startsWith("/escenario-diario")) return false;
                // Enlaces de afuera (GitHub, la consola de Claude…) se abren en el navegador.
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { }
                return true;
            }
        });
        // El marco deja libre el espacio de la barra de la hora, la de gestos y el teclado.
        FrameLayout marco = new FrameLayout(this);
        marco.addView(web);
        setContentView(marco);
        if (Build.VERSION.SDK_INT >= 30) {
            marco.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(b.left, b.top, b.right, b.bottom);
                return WindowInsets.CONSUMED;
            });
        }

        tts = new TextToSpeech(this, estado -> {
            if (estado != TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(new Locale("es", "EC"));
            if (r < 0) r = tts.setLanguage(new Locale("es", "US"));
            if (r < 0) r = tts.setLanguage(new Locale("es"));
            ttsListo = r >= 0;
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {
                    // id = "parte-trozo" o "parte-trozo-fin"; los silencios empiezan con "s".
                    if (id.startsWith("s")) return;
                    js("window.Voz && Voz.parte(" + id.split("-")[0] + ")");
                }
                @Override public void onDone(String id) {
                    if (id.endsWith("-fin")) js("window.Voz && Voz.fin()");
                }
                @Override public void onError(String id) {
                    js("window.Voz && Voz.fin()");
                }
            });
        });

        if (guardado != null) web.restoreState(guardado);
        else web.loadUrl(URL);
    }

    private void js(String codigo) {
        runOnUiThread(() -> web.evaluateJavascript(codigo, null));
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Si sales de la app, deja de escuchar y de leer.
        if (escuchando) terminarOido();
        if (tts != null) tts.stop();
    }

    @Override
    protected void onDestroy() {
        terminarOido();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    // ---------- oído: reconocimiento continuo ----------

    private void iniciarOido() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            js("Dictado.estado('error:Este teléfono no tiene el reconocimiento de voz de Google')");
            return;
        }
        if (oido == null) {
            oido = SpeechRecognizer.createSpeechRecognizer(this);
            oido.setRecognitionListener(new Oyente());
        }
        escuchando = true;
        erroresSeguidos = 0;
        silenciar(true);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        js("Dictado.estado('escuchando')");
        arrancar();
    }

    private void arrancar() {
        if (!escuchando || oido == null) return;
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-EC");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        // Pide aguantar silencios largos; algunos teléfonos lo ignoran, por eso además se reinicia solo.
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 5000);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 5000);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 15000);
        try {
            oido.startListening(i);
        } catch (Exception e) {
            h.postDelayed(this::arrancar, 400);
        }
    }

    private void terminarOido() {
        escuchando = false;
        if (oido != null) {
            try { oido.cancel(); } catch (Exception e) { }
            oido.destroy();
            oido = null;
        }
        silenciar(false);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        js("window.Dictado && Dictado.estado('detenido')");
    }

    // Google hace un "bip" cada vez que vuelve a escuchar; mientras dictas se silencian esos sonidos.
    private void silenciar(boolean si) {
        if (silenciado == si) return;
        silenciado = si;
        AudioManager am = getSystemService(AudioManager.class);
        if (am == null) return;
        int[] canales = { AudioManager.STREAM_MUSIC, AudioManager.STREAM_SYSTEM, AudioManager.STREAM_NOTIFICATION };
        for (int c : canales) {
            try { am.adjustStreamVolume(c, si ? AudioManager.ADJUST_MUTE : AudioManager.ADJUST_UNMUTE, 0); } catch (Exception e) { }
        }
    }

    private static String primero(Bundle b) {
        if (b == null) return "";
        ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return l == null || l.isEmpty() ? "" : l.get(0);
    }

    class Oyente implements RecognitionListener {
        @Override public void onPartialResults(Bundle b) {
            String t = primero(b);
            if (!t.isEmpty()) js("Dictado.parcial(" + JSONObject.quote(t) + ")");
        }
        @Override public void onResults(Bundle b) {
            erroresSeguidos = 0;
            String t = primero(b);
            js("Dictado.final(" + JSONObject.quote(t) + ")");
            if (escuchando) h.postDelayed(MainActivity.this::arrancar, 100);
        }
        @Override public void onError(int e) {
            if (!escuchando) return;
            if (e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                terminarOido();
                js("Dictado.estado('error:La app no tiene permiso de micrófono')");
                return;
            }
            // Silencio o nada entendido: es normal en una pausa, se vuelve a escuchar.
            boolean normal = e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT;
            if (!normal) erroresSeguidos++;
            if (erroresSeguidos >= 6) {
                terminarOido();
                String m = e == SpeechRecognizer.ERROR_NETWORK || e == SpeechRecognizer.ERROR_NETWORK_TIMEOUT
                        ? "Sin internet para el reconocimiento de voz" : "El micrófono se detuvo. Toca Hablar otra vez";
                js("Dictado.estado('error:" + m + "')");
                return;
            }
            if (e == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || e == SpeechRecognizer.ERROR_CLIENT) {
                try { oido.cancel(); } catch (Exception x) { }
            }
            h.postDelayed(MainActivity.this::arrancar, normal ? 100 : 500);
        }
        @Override public void onReadyForSpeech(Bundle b) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float v) { }
        @Override public void onBufferReceived(byte[] b) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int t, Bundle b) { }
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(pedido, permisos, resultados);
        if (pedido != PEDIR_MIC) return;
        boolean ok = resultados.length > 0 && resultados[0] == PackageManager.PERMISSION_GRANTED;
        if (ok && micPendiente) iniciarOido();
        else if (!ok) js("Dictado.estado('error:Sin permiso de micrófono. Actívalo en Ajustes de Android → Apps → Escenario')");
        micPendiente = false;
    }

    // Funciones que la página llama como AndroidVoz.hablar(...), AndroidVoz.escuchar()…
    class Puente {
        // partes: [{"i": número de parte, "t": "texto"}]; vel: 0.7 a 1.2
        @JavascriptInterface
        public void hablar(String partes, float vel) {
            runOnUiThread(() -> {
                if (!ttsListo) { js("Voz.sinVoz()"); return; }
                try {
                    JSONArray a = new JSONArray(partes);
                    tts.stop();
                    tts.setSpeechRate(vel);
                    for (int k = 0; k < a.length(); k++) {
                        JSONObject p = a.getJSONObject(k);
                        String id = p.getInt("i") + "-" + k + (k == a.length() - 1 ? "-fin" : "");
                        tts.speak(p.getString("t"), k == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, id);
                        // La "/" del discurso es una pausa breve.
                        if (k < a.length() - 1) tts.playSilentUtterance(350, TextToSpeech.QUEUE_ADD, "s" + k);
                    }
                } catch (Exception e) {
                    js("Voz.fin()");
                }
            });
        }

        @JavascriptInterface
        public void callar() {
            runOnUiThread(() -> { if (tts != null) tts.stop(); });
        }

        @JavascriptInterface
        public void escuchar() {
            runOnUiThread(() -> {
                if (escuchando) return;
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    micPendiente = true;
                    requestPermissions(new String[]{ Manifest.permission.RECORD_AUDIO }, PEDIR_MIC);
                    return;
                }
                iniciarOido();
            });
        }

        @JavascriptInterface
        public void detener() {
            runOnUiThread(() -> {
                if (!escuchando) return;
                escuchando = false;
                // stopListening entrega lo último que oyó (onResults) antes de cerrar.
                try { if (oido != null) oido.stopListening(); } catch (Exception e) { }
                h.postDelayed(MainActivity.this::terminarOido, 1200);
            });
        }
    }
}

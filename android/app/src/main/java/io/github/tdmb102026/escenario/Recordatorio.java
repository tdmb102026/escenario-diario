package io.github.tdmb102026.escenario;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

// Aviso diario "Hora de practicar" a la hora que elijas en Ajustes. Si ese día ya practicaste, no avisa.
// Se programa una alarma para el día siguiente cada vez que suena, y otra vez al reiniciar el teléfono.
public class Recordatorio extends BroadcastReceiver {
    static final String CANAL = "practica";
    private static final String[] FRASES = {
        "Tu discurso del día te está esperando. Quince minutos y listo.",
        "Un poco cada día le gana a mucho de vez en cuando.",
        "Calienta la voz, ponte de pie y habla. Tú puedes.",
        "La seguridad en el escenario se entrena. Hoy toca entrenar.",
        "Tu próxima gran presentación empieza con la práctica de hoy.",
    };

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("app", Context.MODE_PRIVATE);
    }

    static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) { programar(c); return; }
        programar(c);  // la de mañana
        if (hoy().equals(prefs(c).getString("practico", ""))) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel(CANAL, "Recordatorio de práctica", NotificationManager.IMPORTANCE_DEFAULT));
        Intent abrir = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CANAL)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("Hora de practicar")
                .setContentText(FRASES[(int) (Math.random() * FRASES.length)])
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        try { nm.notify(1, n); } catch (SecurityException e) { }
    }

    // Programa (o quita) la próxima alarma según lo guardado en Ajustes.
    static void programar(Context c) {
        SharedPreferences p = prefs(c);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(c, 0, new Intent(c, Recordatorio.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.cancel(pi);
        if (!p.getBoolean("aviso", false)) return;
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, p.getInt("hora", 19));
        cal.set(Calendar.MINUTE, p.getInt("minuto", 0));
        cal.set(Calendar.SECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 60000) cal.add(Calendar.DAY_OF_MONTH, 1);
        // Ventana de 10 minutos: no necesita el permiso de alarmas exactas.
        am.setWindow(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), 10 * 60 * 1000, pi);
    }
}

import { defineRouteConfig } from '@medusajs/admin-sdk';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createAdminFulfillment,
  createAdminRefund,
  getOrderTimeline,
  OrderTimelineEvent,
  runReturnLifecycle,
  updateAdminTracking,
} from '../../lib/api/admin';

const OrderOperationsPage = () => {
  const { t } = useTranslation();
  const [orderId, setOrderId] = useState('');
  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [locationId, setLocationId] = useState('');
  const [itemId, setItemId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  const [fulfillmentId, setFulfillmentId] = useState('');
  const [shipmentItemId, setShipmentItemId] = useState('');
  const [shipmentItemQuantity, setShipmentItemQuantity] = useState(1);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  const [refundAmount, setRefundAmount] = useState(0);
  const [paymentId, setPaymentId] = useState('');
  const [refundNote, setRefundNote] = useState('');

  const [returnPayload, setReturnPayload] = useState('{"location_id":"","items":[]}');

  const resetNotices = () => {
    setMessage('');
    setError('');
  };

  const loadTimeline = async () => {
    resetNotices();

    try {
      const response = await getOrderTimeline(orderId);
      setTimeline(response.events || []);
      setMessage(t('admin.orderOps.messages.timelineLoaded'));
    } catch (err) {
      setError((err as Error).message || t('admin.orderOps.errors.default'));
    }
  };

  const onCreateFulfillment = async (event: FormEvent) => {
    event.preventDefault();
    resetNotices();

    try {
      await createAdminFulfillment(orderId, {
        location_id: locationId,
        items: [{ id: itemId, quantity: itemQuantity }],
      });
      setMessage(t('admin.orderOps.messages.fulfillmentCreated'));
      await loadTimeline();
    } catch (err) {
      setError((err as Error).message || t('admin.orderOps.errors.default'));
    }
  };

  const onUpdateTracking = async (event: FormEvent) => {
    event.preventDefault();
    resetNotices();

    try {
      await updateAdminTracking(orderId, fulfillmentId, {
        items: [{ id: shipmentItemId, quantity: shipmentItemQuantity }],
        labels: [
          {
            tracking_number: trackingNumber,
            tracking_url: trackingUrl || '#',
            label_url: trackingUrl || '#',
          },
        ],
      });
      setMessage(t('admin.orderOps.messages.trackingUpdated'));
      await loadTimeline();
    } catch (err) {
      setError((err as Error).message || t('admin.orderOps.errors.default'));
    }
  };

  const onCreateRefund = async (event: FormEvent) => {
    event.preventDefault();
    resetNotices();

    try {
      await createAdminRefund(orderId, {
        payment_id: paymentId || undefined,
        amount: refundAmount,
        note: refundNote || undefined,
      });
      setMessage(t('admin.orderOps.messages.refundCreated'));
      await loadTimeline();
    } catch (err) {
      setError((err as Error).message || t('admin.orderOps.errors.default'));
    }
  };

  const onRunReturnLifecycle = async (event: FormEvent) => {
    event.preventDefault();
    resetNotices();

    try {
      const payload = JSON.parse(returnPayload) as Record<string, unknown>;
      await runReturnLifecycle(orderId, {
        action: 'begin',
        payload,
      });
      setMessage(t('admin.orderOps.messages.returnUpdated'));
      await loadTimeline();
    } catch (err) {
      setError((err as Error).message || t('admin.orderOps.errors.default'));
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900 }}>
      <h1>{t('admin.orderOps.title')}</h1>
      <p>{t('admin.orderOps.description')}</p>

      <label>
        {t('admin.orderOps.fields.orderId')}
        <input value={orderId} onChange={(event) => setOrderId(event.target.value)} />
      </label>
      <button type="button" onClick={loadTimeline} disabled={!orderId.trim()}>
        {t('admin.orderOps.actions.loadTimeline')}
      </button>

      <h2>{t('admin.orderOps.sections.fulfillment')}</h2>
      <form onSubmit={onCreateFulfillment}>
        <input
          placeholder={t('admin.orderOps.fields.locationId')}
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        />
        <input placeholder={t('admin.orderOps.fields.itemId')} value={itemId} onChange={(event) => setItemId(event.target.value)} />
        <input
          type="number"
          min={1}
          value={itemQuantity}
          onChange={(event) => setItemQuantity(Number(event.target.value) || 1)}
        />
        <button type="submit">{t('admin.orderOps.actions.createFulfillment')}</button>
      </form>

      <h2>{t('admin.orderOps.sections.tracking')}</h2>
      <form onSubmit={onUpdateTracking}>
        <input
          placeholder={t('admin.orderOps.fields.fulfillmentId')}
          value={fulfillmentId}
          onChange={(event) => setFulfillmentId(event.target.value)}
        />
        <input
          placeholder={t('admin.orderOps.fields.itemId')}
          value={shipmentItemId}
          onChange={(event) => setShipmentItemId(event.target.value)}
        />
        <input
          type="number"
          min={1}
          value={shipmentItemQuantity}
          onChange={(event) => setShipmentItemQuantity(Number(event.target.value) || 1)}
        />
        <input
          placeholder={t('admin.orderOps.fields.trackingNumber')}
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
        />
        <input
          placeholder={t('admin.orderOps.fields.trackingUrl')}
          value={trackingUrl}
          onChange={(event) => setTrackingUrl(event.target.value)}
        />
        <button type="submit">{t('admin.orderOps.actions.updateTracking')}</button>
      </form>

      <h2>{t('admin.orderOps.sections.refund')}</h2>
      <form onSubmit={onCreateRefund}>
        <input
          placeholder={t('admin.orderOps.fields.paymentId')}
          value={paymentId}
          onChange={(event) => setPaymentId(event.target.value)}
        />
        <input
          type="number"
          min={0}
          value={refundAmount}
          onChange={(event) => setRefundAmount(Number(event.target.value) || 0)}
        />
        <input placeholder={t('admin.orderOps.fields.refundNote')} value={refundNote} onChange={(event) => setRefundNote(event.target.value)} />
        <button type="submit">{t('admin.orderOps.actions.createRefund')}</button>
      </form>

      <h2>{t('admin.orderOps.sections.returns')}</h2>
      <form onSubmit={onRunReturnLifecycle}>
        <textarea value={returnPayload} onChange={(event) => setReturnPayload(event.target.value)} rows={6} style={{ width: '100%' }} />
        <button type="submit">{t('admin.orderOps.actions.beginReturn')}</button>
      </form>

      {message ? <p>{message}</p> : null}
      {error ? <p>{error}</p> : null}

      <h2>{t('admin.orderOps.sections.timeline')}</h2>
      {!timeline.length ? <p>{t('admin.orderOps.emptyTimeline')}</p> : null}
      <ul>
        {timeline.map((event) => (
          <li key={event.id}>
            <strong>{event.type}</strong> — {event.label} ({new Date(event.at).toLocaleString()})
          </li>
        ))}
      </ul>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Order operations',
});

export default OrderOperationsPage;

import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Input, Label, Table, Text, Textarea } from '@medusajs/ui';
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
import TenantContextSwitcher from '../../components/tenant-context-switcher';

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
    <div className="flex flex-col gap-y-6 p-6">
      <Container className="p-6">
        <Heading level="h1">{t('admin.orderOps.title')}</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {t('admin.orderOps.description')}
        </Text>
        <TenantContextSwitcher />

        <div className="mt-4 flex items-end gap-3 max-w-xl">
          <div className="flex-1 flex flex-col gap-y-2">
            <Label htmlFor="order_id">{t('admin.orderOps.fields.orderId')}</Label>
            <Input id="order_id" value={orderId} onChange={(event) => setOrderId(event.target.value)} />
          </div>
          <Button type="button" onClick={loadTimeline} disabled={!orderId.trim()}>
            {t('admin.orderOps.actions.loadTimeline')}
          </Button>
        </div>

        {message ? <Text className="mt-3 text-ui-fg-interactive">{message}</Text> : null}
        {error ? <Text className="mt-2 text-ui-fg-error">{error}</Text> : null}
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.orderOps.sections.fulfillment')}</Heading>
        <form onSubmit={onCreateFulfillment} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="location_id">{t('admin.orderOps.fields.locationId')}</Label>
            <Input id="location_id" value={locationId} onChange={(event) => setLocationId(event.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="fulfillment_item_id">{t('admin.orderOps.fields.itemId')}</Label>
            <Input id="fulfillment_item_id" value={itemId} onChange={(event) => setItemId(event.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="fulfillment_item_qty">Qty</Label>
            <Input
              id="fulfillment_item_qty"
              type="number"
              min={1}
              value={itemQuantity}
              onChange={(event) => setItemQuantity(Number(event.target.value) || 1)}
            />
          </div>
          <div>
            <Button type="submit">{t('admin.orderOps.actions.createFulfillment')}</Button>
          </div>
        </form>
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.orderOps.sections.tracking')}</Heading>
        <form onSubmit={onUpdateTracking} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="tracking_fulfillment_id">{t('admin.orderOps.fields.fulfillmentId')}</Label>
            <Input
              id="tracking_fulfillment_id"
              value={fulfillmentId}
              onChange={(event) => setFulfillmentId(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="tracking_item_id">{t('admin.orderOps.fields.itemId')}</Label>
            <Input id="tracking_item_id" value={shipmentItemId} onChange={(event) => setShipmentItemId(event.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="tracking_qty">Qty</Label>
            <Input
              id="tracking_qty"
              type="number"
              min={1}
              value={shipmentItemQuantity}
              onChange={(event) => setShipmentItemQuantity(Number(event.target.value) || 1)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="tracking_number">{t('admin.orderOps.fields.trackingNumber')}</Label>
            <Input id="tracking_number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2 sm:col-span-2">
            <Label htmlFor="tracking_url">{t('admin.orderOps.fields.trackingUrl')}</Label>
            <Input id="tracking_url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} />
          </div>
          <div>
            <Button type="submit">{t('admin.orderOps.actions.updateTracking')}</Button>
          </div>
        </form>
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.orderOps.sections.refund')}</Heading>
        <form onSubmit={onCreateRefund} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="payment_id">{t('admin.orderOps.fields.paymentId')}</Label>
            <Input id="payment_id" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="refund_amount">Amount</Label>
            <Input
              id="refund_amount"
              type="number"
              min={0}
              value={refundAmount}
              onChange={(event) => setRefundAmount(Number(event.target.value) || 0)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="refund_note">{t('admin.orderOps.fields.refundNote')}</Label>
            <Input id="refund_note" value={refundNote} onChange={(event) => setRefundNote(event.target.value)} />
          </div>
          <div>
            <Button type="submit">{t('admin.orderOps.actions.createRefund')}</Button>
          </div>
        </form>
      </Container>

      <Container className="p-6">
        <Heading level="h2">{t('admin.orderOps.sections.returns')}</Heading>
        <form onSubmit={onRunReturnLifecycle} className="mt-4 flex flex-col gap-y-3">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="return_payload">Payload JSON</Label>
            <Textarea id="return_payload" value={returnPayload} onChange={(event) => setReturnPayload(event.target.value)} rows={6} />
          </div>
          <div>
            <Button type="submit">{t('admin.orderOps.actions.beginReturn')}</Button>
          </div>
        </form>
      </Container>

      <Container className="p-0 overflow-hidden">
        <div className="p-6 border-b border-ui-border-base">
          <Heading level="h2">{t('admin.orderOps.sections.timeline')}</Heading>
        </div>
        {!timeline.length ? <Text className="p-6">{t('admin.orderOps.emptyTimeline')}</Text> : null}
        {timeline.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Label</Table.HeaderCell>
                <Table.HeaderCell>Timestamp</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {timeline.map((event) => (
                <Table.Row key={event.id}>
                  <Table.Cell>{event.type}</Table.Cell>
                  <Table.Cell>{event.label}</Table.Cell>
                  <Table.Cell>{new Date(event.at).toLocaleString()}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : null}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
});

export default OrderOperationsPage;

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { List, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Booking {
  id: string;
  event_name: string;
  event_date: string | null;
  confirmed_fee: number;
  payment_status: string;
  amount_paid: number;
  expenses: number | null;
  net_revenue: number | null;
  notes: string | null;
}

interface BookingsTableProps {
  bookings: Booking[];
  onEdit: (booking: Booking) => void;
  onRefresh: () => void;
}

export function BookingsTable({ bookings, onEdit, onRefresh }: BookingsTableProps) {
  const [filter, setFilter] = useState("this_year");
  const [sortBy, setSortBy] = useState<"date" | "fee" | "status">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const filteredBookings = bookings.filter((b) => {
    if (filter === "all") return true;
    if (!b.event_date) return filter === "this_year";
    const year = new Date(b.event_date).getFullYear();
    if (filter === "this_year") return year === currentYear;
    if (filter === "last_year") return year === lastYear;
    return true;
  });

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "date") {
      const dateA = a.event_date ? new Date(a.event_date).getTime() : 0;
      const dateB = b.event_date ? new Date(b.event_date).getTime() : 0;
      comparison = dateA - dateB;
    } else if (sortBy === "fee") {
      comparison = a.confirmed_fee - b.confirmed_fee;
    } else if (sortBy === "status") {
      comparison = a.payment_status.localeCompare(b.payment_status);
    }
    return sortDir === "asc" ? comparison : -comparison;
  });

  const handleSort = (column: "date" | "fee" | "status") => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;

    try {
      const { error } = await supabase
        .from("confirmed_bookings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Booking deleted");
      onRefresh();
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error("Failed to delete booking");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      partial: { variant: "outline", label: "Partial" },
      paid: { variant: "default", label: "Paid" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <List className="h-4 w-4" />
            Confirmed Bookings
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No bookings found. Add your first confirmed booking!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("date")}
                      className="h-8 px-2 -ml-2"
                    >
                      Date
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("fee")}
                      className="h-8 px-2 -ml-2"
                    >
                      Fee
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("status")}
                      className="h-8 px-2 -ml-2"
                    >
                      Status
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {booking.event_name}
                    </TableCell>
                    <TableCell>
                      {booking.event_date
                        ? format(new Date(booking.event_date), "MMM d, yyyy")
                        : "TBD"}
                    </TableCell>
                    <TableCell>{formatCurrency(booking.confirmed_fee)}</TableCell>
                    <TableCell>{getStatusBadge(booking.payment_status)}</TableCell>
                    <TableCell>{formatCurrency(booking.amount_paid)}</TableCell>
                    <TableCell>
                      {booking.net_revenue !== null
                        ? formatCurrency(booking.net_revenue)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(booking)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(booking.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
